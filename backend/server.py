from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import jwt
import bcrypt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Config
JWT_SECRET = os.environ.get('JWT_SECRET', 'kick-wager-secret-key-2025')
JWT_ALGORITHM = "HS256"

# Create the main app
app = FastAPI(title="Kick Wager API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

security = HTTPBearer()

# ==================== MODELS ====================

class UserCreate(BaseModel):
    username: str
    email: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    username: str
    email: str
    is_admin: bool = False
    total_points: int = 0
    created_at: str

class GameCreate(BaseModel):
    home_team: str
    away_team: str
    home_team_abbr: str
    away_team_abbr: str
    game_date: str
    week: int = 1
    season: str = "2025"

class GameUpdate(BaseModel):
    home_score: Optional[int] = None
    away_score: Optional[int] = None
    status: Optional[str] = None  # scheduled, live, finished

class GameResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    home_team: str
    away_team: str
    home_team_abbr: str
    away_team_abbr: str
    game_date: str
    week: int
    season: str
    home_score: Optional[int] = None
    away_score: Optional[int] = None
    status: str = "scheduled"
    created_at: str

class BetCreate(BaseModel):
    game_id: str
    home_score_prediction: int
    away_score_prediction: int

class BetResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    username: str
    game_id: str
    home_score_prediction: int
    away_score_prediction: int
    points_earned: int = 0
    created_at: str

class LeaderboardEntry(BaseModel):
    user_id: str
    username: str
    total_points: int
    total_bets: int
    correct_winners: int
    correct_scores: int

# ==================== GROUP MODELS ====================

class GroupCreate(BaseModel):
    name: str

class GroupResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    invite_code: str
    admin_id: str
    admin_username: str
    members: List[dict]
    created_at: str

class GroupMember(BaseModel):
    user_id: str
    username: str
    joined_at: str

# ==================== AUTH HELPERS ====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, is_admin: bool = False) -> str:
    payload = {
        "user_id": user_id,
        "is_admin": is_admin,
        "exp": datetime.now(timezone.utc).timestamp() + 86400 * 7  # 7 days
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_admin_user(current_user: dict = Depends(get_current_user)):
    if not current_user.get("is_admin", False):
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

# ==================== AUTH ROUTES ====================

@api_router.post("/auth/register", response_model=dict)
async def register(user: UserCreate):
    # Check if user exists
    existing = await db.users.find_one({"$or": [{"email": user.email}, {"username": user.username}]})
    if existing:
        raise HTTPException(status_code=400, detail="User already exists")
    
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "username": user.username,
        "email": user.email,
        "password": hash_password(user.password),
        "is_admin": False,
        "total_points": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    
    token = create_token(user_id)
    return {
        "token": token,
        "user": {
            "id": user_id,
            "username": user.username,
            "email": user.email,
            "is_admin": False,
            "total_points": 0
        }
    }

@api_router.post("/auth/login", response_model=dict)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(user["id"], user.get("is_admin", False))
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "username": user["username"],
            "email": user["email"],
            "is_admin": user.get("is_admin", False),
            "total_points": user.get("total_points", 0)
        }
    }

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(**current_user)

# ==================== GAME ROUTES ====================

@api_router.get("/games", response_model=List[GameResponse])
async def get_games(week: Optional[int] = None, season: Optional[str] = None):
    query = {}
    if week:
        query["week"] = week
    if season:
        query["season"] = season
    
    games = await db.games.find(query, {"_id": 0}).sort("game_date", 1).to_list(100)
    return [GameResponse(**game) for game in games]

@api_router.get("/games/{game_id}", response_model=GameResponse)
async def get_game(game_id: str):
    game = await db.games.find_one({"id": game_id}, {"_id": 0})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    return GameResponse(**game)

@api_router.post("/games", response_model=GameResponse)
async def create_game(game: GameCreate, admin: dict = Depends(get_admin_user)):
    game_id = str(uuid.uuid4())
    game_doc = {
        "id": game_id,
        **game.model_dump(),
        "home_score": None,
        "away_score": None,
        "status": "scheduled",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.games.insert_one(game_doc)
    return GameResponse(**game_doc)

@api_router.put("/games/{game_id}", response_model=GameResponse)
async def update_game(game_id: str, update: GameUpdate, admin: dict = Depends(get_admin_user)):
    game = await db.games.find_one({"id": game_id}, {"_id": 0})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    if update_data:
        await db.games.update_one({"id": game_id}, {"$set": update_data})
        
        # If game is finished, calculate points
        if update_data.get("status") == "finished" and "home_score" in update_data and "away_score" in update_data:
            await calculate_points_for_game(game_id, update_data["home_score"], update_data["away_score"])
    
    updated_game = await db.games.find_one({"id": game_id}, {"_id": 0})
    return GameResponse(**updated_game)

@api_router.delete("/games/{game_id}")
async def delete_game(game_id: str, admin: dict = Depends(get_admin_user)):
    result = await db.games.delete_one({"id": game_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Game not found")
    # Also delete all bets for this game
    await db.bets.delete_many({"game_id": game_id})
    return {"message": "Game deleted"}

# ==================== BET ROUTES ====================

@api_router.post("/bets", response_model=BetResponse)
async def create_bet(bet: BetCreate, current_user: dict = Depends(get_current_user)):
    # Check if game exists and is not finished
    game = await db.games.find_one({"id": bet.game_id}, {"_id": 0})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    if game["status"] == "finished":
        raise HTTPException(status_code=400, detail="Cannot bet on finished game")
    
    # Check if user already bet on this game
    existing_bet = await db.bets.find_one({
        "user_id": current_user["id"],
        "game_id": bet.game_id
    })
    if existing_bet:
        raise HTTPException(status_code=400, detail="You already placed a bet on this game")
    
    bet_id = str(uuid.uuid4())
    bet_doc = {
        "id": bet_id,
        "user_id": current_user["id"],
        "username": current_user["username"],
        "game_id": bet.game_id,
        "home_score_prediction": bet.home_score_prediction,
        "away_score_prediction": bet.away_score_prediction,
        "points_earned": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.bets.insert_one(bet_doc)
    return BetResponse(**bet_doc)

@api_router.get("/bets/game/{game_id}", response_model=List[BetResponse])
async def get_bets_for_game(game_id: str):
    bets = await db.bets.find({"game_id": game_id}, {"_id": 0}).to_list(100)
    return [BetResponse(**bet) for bet in bets]

@api_router.get("/bets/user/{user_id}", response_model=List[BetResponse])
async def get_bets_for_user(user_id: str):
    bets = await db.bets.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return [BetResponse(**bet) for bet in bets]

@api_router.get("/bets/my", response_model=List[BetResponse])
async def get_my_bets(current_user: dict = Depends(get_current_user)):
    bets = await db.bets.find({"user_id": current_user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return [BetResponse(**bet) for bet in bets]

# ==================== LEADERBOARD ====================

@api_router.get("/leaderboard", response_model=List[LeaderboardEntry])
async def get_leaderboard():
    # Aggregate user stats
    pipeline = [
        {
            "$group": {
                "_id": "$user_id",
                "username": {"$first": "$username"},
                "total_points": {"$sum": "$points_earned"},
                "total_bets": {"$sum": 1},
                "correct_winners": {
                    "$sum": {"$cond": [{"$gt": ["$points_earned", 0]}, 1, 0]}
                },
                "correct_scores": {
                    "$sum": {"$cond": [{"$gte": ["$points_earned", 3]}, 1, 0]}
                }
            }
        },
        {"$sort": {"total_points": -1}}
    ]
    
    results = await db.bets.aggregate(pipeline).to_list(100)
    
    return [
        LeaderboardEntry(
            user_id=r["_id"],
            username=r["username"],
            total_points=r["total_points"],
            total_bets=r["total_bets"],
            correct_winners=r["correct_winners"],
            correct_scores=r["correct_scores"]
        )
        for r in results
    ]

# ==================== POINTS CALCULATION ====================

async def calculate_points_for_game(game_id: str, home_score: int, away_score: int):
    """
    Points system:
    - 3 points for correct team score (per team)
    - 1 point for correct winner
    Max possible: 7 points (3 + 3 + 1)
    """
    bets = await db.bets.find({"game_id": game_id}, {"_id": 0}).to_list(1000)
    
    # Determine winner (0 = tie, 1 = home, 2 = away)
    if home_score > away_score:
        actual_winner = 1
    elif away_score > home_score:
        actual_winner = 2
    else:
        actual_winner = 0
    
    for bet in bets:
        points = 0
        
        # Check home score prediction
        if bet["home_score_prediction"] == home_score:
            points += 3
        
        # Check away score prediction
        if bet["away_score_prediction"] == away_score:
            points += 3
        
        # Check winner prediction
        if bet["home_score_prediction"] > bet["away_score_prediction"]:
            predicted_winner = 1
        elif bet["away_score_prediction"] > bet["home_score_prediction"]:
            predicted_winner = 2
        else:
            predicted_winner = 0
        
        if predicted_winner == actual_winner:
            points += 1
        
        # Update bet with points
        await db.bets.update_one(
            {"id": bet["id"]},
            {"$set": {"points_earned": points}}
        )
        
        # Update user total points
        await db.users.update_one(
            {"id": bet["user_id"]},
            {"$inc": {"total_points": points}}
        )

# ==================== ADMIN ROUTES ====================

@api_router.post("/admin/make-admin/{user_id}")
async def make_admin(user_id: str, admin: dict = Depends(get_admin_user)):
    result = await db.users.update_one({"id": user_id}, {"$set": {"is_admin": True}})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User is now admin"}

@api_router.get("/admin/users", response_model=List[UserResponse])
async def get_all_users(admin: dict = Depends(get_admin_user)):
    users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(100)
    return [UserResponse(**user) for user in users]

# ==================== GROUP ROUTES ====================

def generate_invite_code():
    import random
    import string
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))

@api_router.post("/groups", response_model=GroupResponse)
async def create_group(group: GroupCreate, current_user: dict = Depends(get_current_user)):
    group_id = str(uuid.uuid4())
    invite_code = generate_invite_code()
    
    group_doc = {
        "id": group_id,
        "name": group.name,
        "invite_code": invite_code,
        "admin_id": current_user["id"],
        "admin_username": current_user["username"],
        "members": [{
            "user_id": current_user["id"],
            "username": current_user["username"],
            "joined_at": datetime.now(timezone.utc).isoformat()
        }],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.groups.insert_one(group_doc)
    return GroupResponse(**group_doc)

@api_router.get("/groups", response_model=List[GroupResponse])
async def get_my_groups(current_user: dict = Depends(get_current_user)):
    groups = await db.groups.find(
        {"members.user_id": current_user["id"]},
        {"_id": 0}
    ).to_list(100)
    return [GroupResponse(**g) for g in groups]

@api_router.get("/groups/{group_id}", response_model=GroupResponse)
async def get_group(group_id: str, current_user: dict = Depends(get_current_user)):
    group = await db.groups.find_one({"id": group_id}, {"_id": 0})
    if not group:
        raise HTTPException(status_code=404, detail="Gruppe nicht gefunden")
    
    # Check if user is member
    is_member = any(m["user_id"] == current_user["id"] for m in group["members"])
    if not is_member:
        raise HTTPException(status_code=403, detail="Du bist kein Mitglied dieser Gruppe")
    
    return GroupResponse(**group)

@api_router.post("/groups/join/{invite_code}", response_model=GroupResponse)
async def join_group(invite_code: str, current_user: dict = Depends(get_current_user)):
    group = await db.groups.find_one({"invite_code": invite_code}, {"_id": 0})
    if not group:
        raise HTTPException(status_code=404, detail="Ungültiger Einladungscode")
    
    # Check if already member
    is_member = any(m["user_id"] == current_user["id"] for m in group["members"])
    if is_member:
        raise HTTPException(status_code=400, detail="Du bist bereits Mitglied dieser Gruppe")
    
    # Add member
    new_member = {
        "user_id": current_user["id"],
        "username": current_user["username"],
        "joined_at": datetime.now(timezone.utc).isoformat()
    }
    await db.groups.update_one(
        {"id": group["id"]},
        {"$push": {"members": new_member}}
    )
    
    updated_group = await db.groups.find_one({"id": group["id"]}, {"_id": 0})
    return GroupResponse(**updated_group)

@api_router.post("/groups/{group_id}/leave")
async def leave_group(group_id: str, current_user: dict = Depends(get_current_user)):
    group = await db.groups.find_one({"id": group_id}, {"_id": 0})
    if not group:
        raise HTTPException(status_code=404, detail="Gruppe nicht gefunden")
    
    if group["admin_id"] == current_user["id"]:
        raise HTTPException(status_code=400, detail="Admin kann die Gruppe nicht verlassen. Lösche sie stattdessen.")
    
    await db.groups.update_one(
        {"id": group_id},
        {"$pull": {"members": {"user_id": current_user["id"]}}}
    )
    return {"message": "Gruppe verlassen"}

@api_router.post("/groups/{group_id}/kick/{user_id}")
async def kick_member(group_id: str, user_id: str, current_user: dict = Depends(get_current_user)):
    group = await db.groups.find_one({"id": group_id}, {"_id": 0})
    if not group:
        raise HTTPException(status_code=404, detail="Gruppe nicht gefunden")
    
    if group["admin_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Nur der Admin kann Mitglieder entfernen")
    
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Du kannst dich nicht selbst entfernen")
    
    await db.groups.update_one(
        {"id": group_id},
        {"$pull": {"members": {"user_id": user_id}}}
    )
    return {"message": "Mitglied entfernt"}

@api_router.delete("/groups/{group_id}")
async def delete_group(group_id: str, current_user: dict = Depends(get_current_user)):
    group = await db.groups.find_one({"id": group_id}, {"_id": 0})
    if not group:
        raise HTTPException(status_code=404, detail="Gruppe nicht gefunden")
    
    if group["admin_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Nur der Admin kann die Gruppe löschen")
    
    await db.groups.delete_one({"id": group_id})
    return {"message": "Gruppe gelöscht"}

@api_router.get("/groups/{group_id}/bets/{game_id}", response_model=List[BetResponse])
async def get_group_bets_for_game(group_id: str, game_id: str, current_user: dict = Depends(get_current_user)):
    group = await db.groups.find_one({"id": group_id}, {"_id": 0})
    if not group:
        raise HTTPException(status_code=404, detail="Gruppe nicht gefunden")
    
    is_member = any(m["user_id"] == current_user["id"] for m in group["members"])
    if not is_member:
        raise HTTPException(status_code=403, detail="Du bist kein Mitglied dieser Gruppe")
    
    member_ids = [m["user_id"] for m in group["members"]]
    bets = await db.bets.find(
        {"game_id": game_id, "user_id": {"$in": member_ids}},
        {"_id": 0}
    ).to_list(100)
    return [BetResponse(**bet) for bet in bets]

@api_router.get("/groups/{group_id}/leaderboard", response_model=List[LeaderboardEntry])
async def get_group_leaderboard(group_id: str, current_user: dict = Depends(get_current_user)):
    group = await db.groups.find_one({"id": group_id}, {"_id": 0})
    if not group:
        raise HTTPException(status_code=404, detail="Gruppe nicht gefunden")
    
    is_member = any(m["user_id"] == current_user["id"] for m in group["members"])
    if not is_member:
        raise HTTPException(status_code=403, detail="Du bist kein Mitglied dieser Gruppe")
    
    member_ids = [m["user_id"] for m in group["members"]]
    
    pipeline = [
        {"$match": {"user_id": {"$in": member_ids}}},
        {
            "$group": {
                "_id": "$user_id",
                "username": {"$first": "$username"},
                "total_points": {"$sum": "$points_earned"},
                "total_bets": {"$sum": 1},
                "correct_winners": {
                    "$sum": {"$cond": [{"$gt": ["$points_earned", 0]}, 1, 0]}
                },
                "correct_scores": {
                    "$sum": {"$cond": [{"$gte": ["$points_earned", 3]}, 1, 0]}
                }
            }
        },
        {"$sort": {"total_points": -1}}
    ]
    
    results = await db.bets.aggregate(pipeline).to_list(100)
    
    return [
        LeaderboardEntry(
            user_id=r["_id"],
            username=r["username"],
            total_points=r["total_points"],
            total_bets=r["total_bets"],
            correct_winners=r["correct_winners"],
            correct_scores=r["correct_scores"]
        )
        for r in results
    ]

# ==================== USER ACCOUNT ROUTES ====================

@api_router.delete("/auth/delete-account")
async def delete_account(current_user: dict = Depends(get_current_user)):
    user_id = current_user["id"]
    
    # Delete user's bets
    await db.bets.delete_many({"user_id": user_id})
    
    # Remove from all groups
    await db.groups.update_many(
        {"members.user_id": user_id},
        {"$pull": {"members": {"user_id": user_id}}}
    )
    
    # Delete groups where user is admin
    await db.groups.delete_many({"admin_id": user_id})
    
    # Delete user
    await db.users.delete_one({"id": user_id})
    
    return {"message": "Account gelöscht"}

# ==================== SETUP ====================

@api_router.get("/")
async def root():
    return {"message": "Kick Wager API", "version": "1.0.0"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup():
    # Create indexes
    await db.users.create_index("email", unique=True)
    await db.users.create_index("username", unique=True)
    await db.games.create_index("game_date")
    await db.bets.create_index([("user_id", 1), ("game_id", 1)], unique=True)
    await db.groups.create_index("invite_code", unique=True)
    
    # Create default admin if not exists
    admin = await db.users.find_one({"email": "admin@kickwager.com"})
    if not admin:
        admin_doc = {
            "id": str(uuid.uuid4()),
            "username": "admin",
            "email": "admin@kickwager.com",
            "password": hash_password("admin123"),
            "is_admin": True,
            "total_points": 0,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(admin_doc)
        logger.info("Default admin created: admin@kickwager.com / admin123")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
