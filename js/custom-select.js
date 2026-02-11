// Custom Select Dropdown - ersetzt native Browser-Dropdowns
// Wird automatisch auf alle select.form-input Elemente angewendet

(function() {
  'use strict';

  // Warte bis DOM geladen ist
  document.addEventListener('DOMContentLoaded', function() {
    // Kurze Verzögerung um sicherzustellen dass alle Selects gerendert sind
    setTimeout(initAllCustomSelects, 150);
  });

  // Beobachte DOM-Änderungen für dynamisch hinzugefügte Selects
  const observer = new MutationObserver(function(mutations) {
    let hasNewSelects = false;
    mutations.forEach(function(mutation) {
      mutation.addedNodes.forEach(function(node) {
        if (node.nodeType === 1) {
          // Prüfe ob es ein Select ist oder Selects enthält
          if (node.matches && node.matches('select.form-input:not([data-custom-select])')) {
            hasNewSelects = true;
          }
          const selects = node.querySelectorAll && node.querySelectorAll('select.form-input:not([data-custom-select])');
          if (selects && selects.length > 0) {
            hasNewSelects = true;
          }
        }
      });
    });
    
    // Nur einmal initialisieren wenn neue Selects gefunden wurden
    if (hasNewSelects) {
      setTimeout(initAllCustomSelects, 50);
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  function initAllCustomSelects() {
    document.querySelectorAll('select.form-input:not([data-custom-select])').forEach(createCustomSelect);
  }

  function createCustomSelect(select) {
    if (!select || select.hasAttribute('data-custom-select')) return;
    
    // Markiere sofort als initialisiert um Doppel-Erstellung zu verhindern
    select.setAttribute('data-custom-select', 'true');
    
    // Prüfe ob bereits ein Wrapper existiert
    if (select.closest('.custom-select')) return;

    // Wrapper erstellen
    const wrapper = document.createElement('div');
    wrapper.className = 'custom-select';
    
    // Übernehme inline styles vom Original
    if (select.style.width) {
      wrapper.style.width = select.style.width;
    }
    if (select.style.minWidth) {
      wrapper.style.minWidth = select.style.minWidth;
    }

    // Trigger Button
    const trigger = document.createElement('div');
    trigger.className = 'custom-select-trigger';
    trigger.setAttribute('tabindex', '0');
    updateTriggerContent(trigger, select);

    // Options Container
    const optionsContainer = document.createElement('div');
    optionsContainer.className = 'custom-select-options';
    renderOptions(select, optionsContainer);

    // Zusammenbauen
    select.parentNode.insertBefore(wrapper, select);
    wrapper.appendChild(trigger);
    wrapper.appendChild(optionsContainer);
    wrapper.appendChild(select);

    // Original Select verstecken
    select.style.position = 'absolute';
    select.style.opacity = '0';
    select.style.pointerEvents = 'none';
    select.style.width = '1px';
    select.style.height = '1px';
    select.style.overflow = 'hidden';

    // Event Listeners
    trigger.addEventListener('click', function(e) {
      e.stopPropagation();
      toggleDropdown(wrapper);
    });

    trigger.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleDropdown(wrapper);
      }
    });

    // Synchronisiere wenn sich das Original-Select ändert (programmatisch)
    select.addEventListener('change', function() {
      updateTriggerContent(trigger, select);
      updateSelectedOption(optionsContainer, select.value);
    });

    // Beobachte Änderungen an den Options (für dynamisch befüllte Selects)
    const selectObserver = new MutationObserver(function() {
      renderOptions(select, optionsContainer);
      updateTriggerContent(trigger, select);
    });
    selectObserver.observe(select, { childList: true, subtree: true, characterData: true });
  }

  function updateTriggerContent(trigger, select) {
    const text = getSelectedText(select);
    trigger.innerHTML = `
      <span class="custom-select-value">${text}</span>
      <i class="fas fa-chevron-down custom-select-arrow"></i>
    `;
  }

  function getSelectedText(select) {
    const selected = select.options[select.selectedIndex];
    return selected ? selected.textContent : '';
  }

  function renderOptions(select, container) {
    container.innerHTML = '';
    Array.from(select.options).forEach(function(option) {
      const optionEl = document.createElement('div');
      optionEl.className = 'custom-select-option';
      if (option.selected) optionEl.classList.add('selected');
      optionEl.setAttribute('data-value', option.value);
      optionEl.textContent = option.textContent;
      
      optionEl.addEventListener('click', function(e) {
        e.stopPropagation();
        select.value = option.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        closeAllDropdowns();
      });
      
      container.appendChild(optionEl);
    });
  }

  function updateSelectedOption(container, value) {
    container.querySelectorAll('.custom-select-option').forEach(function(opt) {
      opt.classList.toggle('selected', opt.getAttribute('data-value') === value);
    });
  }

  function toggleDropdown(wrapper) {
    const isOpen = wrapper.classList.contains('open');
    closeAllDropdowns();
    if (!isOpen) {
      wrapper.classList.add('open');
    }
  }

  function closeAllDropdowns() {
    document.querySelectorAll('.custom-select.open').forEach(function(el) {
      el.classList.remove('open');
    });
  }

  // Schließe Dropdowns bei Klick außerhalb
  document.addEventListener('click', function(e) {
    if (!e.target.closest('.custom-select')) {
      closeAllDropdowns();
    }
  });

  // Schließe bei Escape
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      closeAllDropdowns();
    }
  });

})();
