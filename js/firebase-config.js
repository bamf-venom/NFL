// ==================== FIREBASE CONFIGURATION ====================
// Firebase SDK Version 10.7.1 - Compat Mode
// ===============================================================

const firebaseConfig = {
  apiKey: "AIzaSyBhhPFVV_cyH5kPMVFM55gpeMvCms8-l9U",
  authDomain: "projekt1-95e74.firebaseapp.com",
  projectId: "projekt1-95e74",
  storageBucket: "projekt1-95e74.firebasestorage.app",
  messagingSenderId: "204324789350",
  appId: "1:204324789350:web:c54182f94b57a8e5a521a7",
  measurementId: "G-ZXV5PPJR04"
};

// ==================== FIREBASE INITIALIZATION ====================
let app, auth, db;

function initializeFirebase() {
  if (typeof firebase !== 'undefined') {
    try {
      // Prüfen ob schon initialisiert
      if (firebase.apps.length === 0) {
        app = firebase.initializeApp(firebaseConfig);
      } else {
        app = firebase.apps[0];
      }
      auth = firebase.auth();
      db = firebase.firestore();
      
      // Enable offline persistence
      db.enablePersistence().catch((err) => {
        if (err.code === 'failed-precondition') {
          console.warn('Firestore persistence failed: Multiple tabs open');
        } else if (err.code === 'unimplemented') {
          console.warn('Firestore persistence not available');
        }
      });
      
      console.log('✅ Firebase initialized successfully');
      console.log('📦 Project ID:', firebaseConfig.projectId);
      
      // Debug: Test Firestore connection
      testFirestoreConnection();
      
      return true;
    } catch (error) {
      console.error('❌ Firebase initialization error:', error);
      return false;
    }
  }
  console.error('❌ Firebase SDK not loaded');
  return false;
}

// Debug function to test Firestore
async function testFirestoreConnection() {
  try {
    console.log('🔍 Testing Firestore connection...');
    
    // Test 1: Prüfe Auth Status
    const user = auth.currentUser;
    console.log('👤 Current Auth User:', user ? user.uid : 'NICHT EINGELOGGT');
    
    // Test 2: Versuche Games zu laden
    const gamesSnapshot = await db.collection('games').limit(1).get();
    console.log('🎮 Games Collection Test:', gamesSnapshot.empty ? 'LEER oder KEINE BERECHTIGUNG' : 'OK - ' + gamesSnapshot.size + ' Dokument(e)');
    
    // Test 3: Versuche Users zu laden
    const usersSnapshot = await db.collection('users').limit(1).get();
    console.log('👥 Users Collection Test:', usersSnapshot.empty ? 'LEER oder KEINE BERECHTIGUNG' : 'OK - ' + usersSnapshot.size + ' Dokument(e)');
    
    // Test 4: Versuche Groups zu laden
    const groupsSnapshot = await db.collection('groups').limit(1).get();
    console.log('📁 Groups Collection Test:', groupsSnapshot.empty ? 'LEER oder KEINE BERECHTIGUNG' : 'OK - ' + groupsSnapshot.size + ' Dokument(e)');
    
  } catch (error) {
    console.error('❌ Firestore Test Error:', error.code, error.message);
  }
}

// ==================== FIRESTORE COLLECTIONS ====================
const collections = {
  users: () => db.collection('users'),
  games: () => db.collection('games'),
  bets: () => db.collection('bets'),
  groups: () => db.collection('groups'),
};

// ==================== AUTH HELPERS ====================
async function firebaseRegister(email, password, username) {
  const userCredential = await auth.createUserWithEmailAndPassword(email, password);
  const user = userCredential.user;
  
  const userData = {
    id: user.uid,
    username: username,
    email: email,
    is_admin: false,
    total_points: 0,
    created_at: firebase.firestore.FieldValue.serverTimestamp()
  };
  
  await collections.users().doc(user.uid).set(userData);
  
  return { ...userData, created_at: new Date().toISOString() };
}

async function firebaseLogin(email, password) {
  const userCredential = await auth.signInWithEmailAndPassword(email, password);
  const user = userCredential.user;
  
  const userDoc = await collections.users().doc(user.uid).get();
  
  if (!userDoc.exists) {
    throw new Error('Benutzerdaten nicht gefunden');
  }
  
  const userData = userDoc.data();
  return {
    ...userData,
    created_at: userData.created_at?.toDate?.()?.toISOString() || new Date().toISOString()
  };
}

async function firebaseLogout() {
  await auth.signOut();
}

async function firebaseGetCurrentUser() {
  const user = auth.currentUser;
  if (!user) return null;
  
  const userDoc = await collections.users().doc(user.uid).get();
  if (!userDoc.exists) return null;
  
  const userData = userDoc.data();
  return {
    ...userData,
    created_at: userData.created_at?.toDate?.()?.toISOString() || new Date().toISOString()
  };
}

async function firebaseDeleteAccount() {
  const user = auth.currentUser;
  if (!user) throw new Error('Nicht angemeldet');
  
  await collections.users().doc(user.uid).delete();
  
  const betsSnapshot = await collections.bets().where('user_id', '==', user.uid).get();
  const batch = db.batch();
  betsSnapshot.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
  
  await user.delete();
}

// ==================== GAMES HELPERS ====================
async function firebaseGetGames(filters = {}) {
  try {
    // Einfache Abfrage ohne orderBy um Index-Probleme zu vermeiden
    let query = collections.games();
    
    if (filters.week) {
      query = query.where('week', '==', filters.week);
    }
    if (filters.season) {
      query = query.where('season', '==', filters.season);
    }
    
    const snapshot = await query.get();
    const games = snapshot.docs.map(doc => ({
      ...doc.data(),
      game_date: doc.data().game_date?.toDate?.()?.toISOString() || doc.data().game_date,
      created_at: doc.data().created_at?.toDate?.()?.toISOString() || doc.data().created_at
    }));
    
    // Sortiere client-seitig nach game_date
    return games.sort((a, b) => new Date(a.game_date) - new Date(b.game_date));
  } catch (error) {
    console.error('Error in firebaseGetGames:', error);
    throw error;
  }
}

async function firebaseGetGame(gameId) {
  const doc = await collections.games().doc(gameId).get();
  if (!doc.exists) return null;
  
  const data = doc.data();
  return {
    ...data,
    game_date: data.game_date?.toDate?.()?.toISOString() || data.game_date,
    created_at: data.created_at?.toDate?.()?.toISOString() || data.created_at
  };
}

async function firebaseCreateGame(gameData) {
  const gameId = db.collection('_').doc().id;
  const game = {
    id: gameId,
    ...gameData,
    game_date: firebase.firestore.Timestamp.fromDate(new Date(gameData.game_date)),
    home_score: null,
    away_score: null,
    status: 'scheduled',
    created_at: firebase.firestore.FieldValue.serverTimestamp()
  };
  
  await collections.games().doc(gameId).set(game);
  return { ...game, game_date: gameData.game_date, created_at: new Date().toISOString() };
}

async function firebaseUpdateGame(gameId, updateData) {
  await collections.games().doc(gameId).update(updateData);
  
  if (updateData.status === 'finished' && updateData.home_score != null && updateData.away_score != null) {
    await calculatePointsForGame(gameId, updateData.home_score, updateData.away_score);
  }
  
  return await firebaseGetGame(gameId);
}

async function firebaseDeleteGame(gameId) {
  await collections.games().doc(gameId).delete();
  
  const betsSnapshot = await collections.bets().where('game_id', '==', gameId).get();
  const batch = db.batch();
  betsSnapshot.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
}

// ==================== BETS HELPERS ====================
async function firebaseGetGameBets(gameId) {
  try {
    const snapshot = await collections.bets()
      .where('game_id', '==', gameId)
      .get();
    
    const bets = snapshot.docs.map(doc => ({
      ...doc.data(),
      created_at: doc.data().created_at?.toDate?.()?.toISOString() || doc.data().created_at
    }));
    
    // Sortiere client-seitig
    return bets.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  } catch (error) {
    console.error('Error in firebaseGetGameBets:', error);
    throw error;
  }
}

async function firebaseGetUserBets(userId) {
  try {
    const snapshot = await collections.bets()
      .where('user_id', '==', userId)
      .get();
    
    const bets = snapshot.docs.map(doc => ({
      ...doc.data(),
      created_at: doc.data().created_at?.toDate?.()?.toISOString() || doc.data().created_at
    }));
    
    // Sortiere client-seitig
    return bets.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  } catch (error) {
    console.error('Error in firebaseGetUserBets:', error);
    throw error;
  }
}

async function firebasePlaceBet(betData) {
  const user = auth.currentUser;
  if (!user) throw new Error('Nicht angemeldet');
  
  const existing = await collections.bets()
    .where('user_id', '==', user.uid)
    .where('game_id', '==', betData.game_id)
    .get();
  
  if (!existing.empty) {
    throw new Error('Du hast bereits auf dieses Spiel gewettet');
  }
  
  const userDoc = await collections.users().doc(user.uid).get();
  const userData = userDoc.data();
  
  const betId = db.collection('_').doc().id;
  const bet = {
    id: betId,
    user_id: user.uid,
    username: userData.username,
    game_id: betData.game_id,
    home_score_prediction: betData.home_score_prediction,
    away_score_prediction: betData.away_score_prediction,
    points_earned: 0,
    created_at: firebase.firestore.FieldValue.serverTimestamp()
  };
  
  await collections.bets().doc(betId).set(bet);
  return { ...bet, created_at: new Date().toISOString() };
}

async function firebaseUpdateBet(betId, betData) {
  await collections.bets().doc(betId).update({
    home_score_prediction: betData.home_score_prediction,
    away_score_prediction: betData.away_score_prediction
  });
  
  const doc = await collections.bets().doc(betId).get();
  return {
    ...doc.data(),
    created_at: doc.data().created_at?.toDate?.()?.toISOString() || doc.data().created_at
  };
}

// Wette löschen
async function firebaseDeleteBet(betId) {
  const user = auth.currentUser;
  if (!user) throw new Error('Nicht angemeldet');
  
  // Prüfe ob es die eigene Wette ist
  const betDoc = await collections.bets().doc(betId).get();
  if (!betDoc.exists) {
    throw new Error('Wette nicht gefunden');
  }
  
  const betData = betDoc.data();
  if (betData.user_id !== user.uid) {
    throw new Error('Du kannst nur deine eigenen Wetten löschen');
  }
  
  // Prüfe ob das Spiel noch nicht gestartet ist
  const gameDoc = await collections.games().doc(betData.game_id).get();
  if (gameDoc.exists) {
    const gameData = gameDoc.data();
    const gameDate = gameData.game_date?.toDate?.() || new Date(gameData.game_date);
    if (new Date() >= gameDate) {
      throw new Error('Das Spiel hat bereits begonnen. Wette kann nicht mehr gelöscht werden.');
    }
  }
  
  await collections.bets().doc(betId).delete();
}

// Alle Wetten des aktuellen Users laden (für Spielübersicht)
async function firebaseGetCurrentUserBets() {
  const user = auth.currentUser;
  if (!user) return [];
  
  try {
    const snapshot = await collections.bets()
      .where('user_id', '==', user.uid)
      .get();
    
    return snapshot.docs.map(doc => ({
      ...doc.data(),
      created_at: doc.data().created_at?.toDate?.()?.toISOString() || doc.data().created_at
    }));
  } catch (error) {
    console.error('Error in firebaseGetCurrentUserBets:', error);
    return [];
  }
}

async function calculatePointsForGame(gameId, homeScore, awayScore) {
  const betsSnapshot = await collections.bets().where('game_id', '==', gameId).get();
  
  let actualWinner;
  if (homeScore > awayScore) actualWinner = 1;
  else if (awayScore > homeScore) actualWinner = 2;
  else actualWinner = 0;
  
  const batch = db.batch();
  const userPointsMap = {};
  
  betsSnapshot.docs.forEach(doc => {
    const bet = doc.data();
    let points = 0;
    
    if (bet.home_score_prediction === homeScore) points += 3;
    if (bet.away_score_prediction === awayScore) points += 3;
    
    let predictedWinner;
    if (bet.home_score_prediction > bet.away_score_prediction) predictedWinner = 1;
    else if (bet.away_score_prediction > bet.home_score_prediction) predictedWinner = 2;
    else predictedWinner = 0;
    
    if (predictedWinner === actualWinner) points += 1;
    
    batch.update(doc.ref, { points_earned: points });
    
    if (!userPointsMap[bet.user_id]) userPointsMap[bet.user_id] = 0;
    userPointsMap[bet.user_id] += points;
  });
  
  await batch.commit();
  
  for (const [userId, points] of Object.entries(userPointsMap)) {
    await collections.users().doc(userId).update({
      total_points: firebase.firestore.FieldValue.increment(points)
    });
  }
}

// ==================== LEADERBOARD HELPERS ====================
async function firebaseGetLeaderboard() {
  const snapshot = await collections.bets().get();
  
  const userStats = {};
  
  snapshot.docs.forEach(doc => {
    const bet = doc.data();
    if (!userStats[bet.user_id]) {
      userStats[bet.user_id] = {
        user_id: bet.user_id,
        username: bet.username,
        total_points: 0,
        total_bets: 0,
        correct_winners: 0,
        correct_scores: 0
      };
    }
    
    userStats[bet.user_id].total_points += bet.points_earned || 0;
    userStats[bet.user_id].total_bets += 1;
    if (bet.points_earned > 0) userStats[bet.user_id].correct_winners += 1;
    if (bet.points_earned >= 3) userStats[bet.user_id].correct_scores += 1;
  });
  
  return Object.values(userStats).sort((a, b) => b.total_points - a.total_points);
}

// ==================== GROUPS HELPERS ====================
function generateInviteCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

async function firebaseGetUserGroups() {
  // Warte auf Auth wenn nötig
  let user = auth.currentUser;
  
  if (!user) {
    // Versuche aus localStorage
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const userData = JSON.parse(storedUser);
      // Warte kurz auf Firebase Auth
      await new Promise(resolve => setTimeout(resolve, 500));
      user = auth.currentUser;
    }
  }
  
  if (!user) {
    console.log('firebaseGetUserGroups: Kein User eingeloggt');
    return [];
  }
  
  try {
    console.log('firebaseGetUserGroups: Lade Gruppen für User', user.uid);
    const snapshot = await collections.groups()
      .where('member_ids', 'array-contains', user.uid)
      .get();
    
    console.log('firebaseGetUserGroups: Gefunden', snapshot.docs.length, 'Gruppen');
    
    return snapshot.docs.map(doc => ({
      ...doc.data(),
      created_at: doc.data().created_at?.toDate?.()?.toISOString() || doc.data().created_at
    }));
  } catch (error) {
    console.error('Error in firebaseGetUserGroups:', error);
    throw error;
  }
}

async function firebaseGetGroup(groupId) {
  const doc = await collections.groups().doc(groupId).get();
  if (!doc.exists) return null;
  
  const data = doc.data();
  return {
    ...data,
    created_at: data.created_at?.toDate?.()?.toISOString() || data.created_at
  };
}

async function firebaseCreateGroup(name) {
  const user = auth.currentUser;
  if (!user) throw new Error('Nicht angemeldet');
  
  const userDoc = await collections.users().doc(user.uid).get();
  const userData = userDoc.data();
  
  const groupId = db.collection('_').doc().id;
  const inviteCode = generateInviteCode();
  
  const group = {
    id: groupId,
    name: name,
    admin_id: user.uid,
    invite_code: inviteCode,
    member_ids: [user.uid],
    members: [{
      user_id: user.uid,
      username: userData.username,
      joined_at: new Date().toISOString()
    }],
    created_at: firebase.firestore.FieldValue.serverTimestamp()
  };
  
  await collections.groups().doc(groupId).set(group);
  return { ...group, created_at: new Date().toISOString() };
}

async function firebaseJoinGroup(inviteCode) {
  const user = auth.currentUser;
  if (!user) throw new Error('Nicht angemeldet');
  
  const snapshot = await collections.groups()
    .where('invite_code', '==', inviteCode.toUpperCase())
    .get();
  
  if (snapshot.empty) {
    throw new Error('Ungültiger Einladungscode');
  }
  
  const groupDoc = snapshot.docs[0];
  const groupData = groupDoc.data();
  
  if (groupData.member_ids.includes(user.uid)) {
    throw new Error('Du bist bereits Mitglied dieser Gruppe');
  }
  
  const userDoc = await collections.users().doc(user.uid).get();
  const userData = userDoc.data();
  
  await groupDoc.ref.update({
    member_ids: firebase.firestore.FieldValue.arrayUnion(user.uid),
    members: firebase.firestore.FieldValue.arrayUnion({
      user_id: user.uid,
      username: userData.username,
      joined_at: new Date().toISOString()
    })
  });
  
  return await firebaseGetGroup(groupDoc.id);
}

async function firebaseLeaveGroup(groupId) {
  const user = auth.currentUser;
  if (!user) throw new Error('Nicht angemeldet');
  
  const groupDoc = await collections.groups().doc(groupId).get();
  const groupData = groupDoc.data();
  
  if (groupData.admin_id === user.uid) {
    throw new Error('Als Admin kannst du die Gruppe nicht verlassen. Lösche sie stattdessen.');
  }
  
  const updatedMembers = groupData.members.filter(m => m.user_id !== user.uid);
  const updatedMemberIds = groupData.member_ids.filter(id => id !== user.uid);
  
  await groupDoc.ref.update({
    member_ids: updatedMemberIds,
    members: updatedMembers
  });
}

async function firebaseKickMember(groupId, userId) {
  const user = auth.currentUser;
  if (!user) throw new Error('Nicht angemeldet');
  
  const groupDoc = await collections.groups().doc(groupId).get();
  const groupData = groupDoc.data();
  
  if (groupData.admin_id !== user.uid) {
    throw new Error('Nur der Admin kann Mitglieder entfernen');
  }
  
  if (userId === groupData.admin_id) {
    throw new Error('Du kannst dich nicht selbst entfernen');
  }
  
  const updatedMembers = groupData.members.filter(m => m.user_id !== userId);
  const updatedMemberIds = groupData.member_ids.filter(id => id !== userId);
  
  await groupDoc.ref.update({
    member_ids: updatedMemberIds,
    members: updatedMembers
  });
}

async function firebaseDeleteGroup(groupId) {
  const user = auth.currentUser;
  if (!user) throw new Error('Nicht angemeldet');
  
  const groupDoc = await collections.groups().doc(groupId).get();
  const groupData = groupDoc.data();
  
  if (groupData.admin_id !== user.uid) {
    throw new Error('Nur der Admin kann die Gruppe löschen');
  }
  
  await groupDoc.ref.delete();
}

// Gruppenname ändern (nur Admin)
async function firebaseUpdateGroupName(groupId, newName) {
  const user = auth.currentUser;
  if (!user) throw new Error('Nicht angemeldet');
  
  const groupDoc = await collections.groups().doc(groupId).get();
  if (!groupDoc.exists) {
    throw new Error('Gruppe nicht gefunden');
  }
  
  const groupData = groupDoc.data();
  
  if (groupData.admin_id !== user.uid) {
    throw new Error('Nur der Admin kann den Gruppennamen ändern');
  }
  
  if (!newName || newName.trim().length < 2) {
    throw new Error('Gruppenname muss mindestens 2 Zeichen haben');
  }
  
  await groupDoc.ref.update({
    name: newName.trim()
  });
  
  return await firebaseGetGroup(groupId);
}

async function firebaseGetGroupLeaderboard(groupId) {
  const groupDoc = await collections.groups().doc(groupId).get();
  const groupData = groupDoc.data();
  
  const memberIds = groupData.member_ids;
  if (memberIds.length === 0) return [];
  
  const chunks = [];
  for (let i = 0; i < memberIds.length; i += 10) {
    chunks.push(memberIds.slice(i, i + 10));
  }
  
  const userStats = {};
  
  for (const chunk of chunks) {
    const snapshot = await collections.bets()
      .where('user_id', 'in', chunk)
      .get();
    
    snapshot.docs.forEach(doc => {
      const bet = doc.data();
      if (!userStats[bet.user_id]) {
        userStats[bet.user_id] = {
          user_id: bet.user_id,
          username: bet.username,
          total_points: 0,
          total_bets: 0,
          correct_winners: 0,
          correct_scores: 0
        };
      }
      
      userStats[bet.user_id].total_points += bet.points_earned || 0;
      userStats[bet.user_id].total_bets += 1;
      if (bet.points_earned > 0) userStats[bet.user_id].correct_winners += 1;
      if (bet.points_earned >= 3) userStats[bet.user_id].correct_scores += 1;
    });
  }
  
  return Object.values(userStats).sort((a, b) => b.total_points - a.total_points);
}

async function firebaseGetGroupBets(groupId, gameId) {
  const groupDoc = await collections.groups().doc(groupId).get();
  const groupData = groupDoc.data();
  
  const memberIds = groupData.member_ids;
  if (memberIds.length === 0) return [];
  
  const allBets = [];
  
  const chunks = [];
  for (let i = 0; i < memberIds.length; i += 10) {
    chunks.push(memberIds.slice(i, i + 10));
  }
  
  for (const chunk of chunks) {
    const snapshot = await collections.bets()
      .where('user_id', 'in', chunk)
      .where('game_id', '==', gameId)
      .get();
    
    snapshot.docs.forEach(doc => {
      allBets.push({
        ...doc.data(),
        created_at: doc.data().created_at?.toDate?.()?.toISOString() || doc.data().created_at
      });
    });
  }
  
  return allBets;
}

// ==================== ADMIN HELPERS ====================
async function firebaseGetAllUsers() {
  const snapshot = await collections.users().get();
  return snapshot.docs.map(doc => ({
    ...doc.data(),
    created_at: doc.data().created_at?.toDate?.()?.toISOString() || doc.data().created_at
  }));
}

async function firebaseDeleteUser(userId) {
  await collections.users().doc(userId).delete();
  
  const betsSnapshot = await collections.bets().where('user_id', '==', userId).get();
  const batch = db.batch();
  betsSnapshot.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
}
