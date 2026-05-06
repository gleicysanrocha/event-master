// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyCK_iUPG-yGOvWr0fn71RH6lirmRU8bLBk",
  authDomain: "eventmaster-8d2c2.firebaseapp.com",
  projectId: "eventmaster-8d2c2",
  storageBucket: "eventmaster-8d2c2.firebasestorage.app",
  messagingSenderId: "50578141487",
  appId: "1:50578141487:web:0e13e99748f7e71ccd31da"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Gerenciamento de Estado da App
let events = [];
let participants = [];
let expenses = [];
let currentEventId = null;

let isAppInitialized = false;

async function syncToFirebase(collection, data) {
    if (!auth.currentUser) return;
    try {
        await db.collection('eventMasterData').doc(collection).set({ items: data });
    } catch (e) {
        console.error("Erro ao salvar na nuvem:", e);
    }
}

// Interceptar salvamentos locais para enviar para a nuvem
const originalSetItem = localStorage.setItem.bind(localStorage);
localStorage.setItem = function(key, value) {
    originalSetItem(key, value);
    if (key === 'event_master_events') syncToFirebase('events', JSON.parse(value));
    if (key === 'event_master_participants') syncToFirebase('participants', JSON.parse(value));
    if (key === 'event_master_expenses') syncToFirebase('expenses', JSON.parse(value));
};

// Listeners de Login
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    if(loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const pass = document.getElementById('login-password').value;
            const btn = document.getElementById('login-btn');
            const err = document.getElementById('login-error');
            
            btn.textContent = 'Carregando...';
            btn.disabled = true;
            
            auth.signInWithEmailAndPassword(email, pass).catch(error => {
                err.textContent = 'Erro: Verifique seu e-mail e senha.';
                err.style.display = 'block';
                btn.textContent = 'Entrar';
                btn.disabled = false;
            });
        });
    }
});

// Listener de Autenticação
auth.onAuthStateChanged(async (user) => {
    if (user) {
        document.getElementById('login-container').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        
        try {
            // Load from Firebase
            const evDoc = await db.collection('eventMasterData').doc('events').get();
            const paDoc = await db.collection('eventMasterData').doc('participants').get();
            const exDoc = await db.collection('eventMasterData').doc('expenses').get();
            
            if (evDoc.exists) events = evDoc.data().items || [];
            if (paDoc.exists) participants = paDoc.data().items || [];
            if (exDoc.exists) expenses = exDoc.data().items || [];
            
            // Previne loop de salvamento ao carregar restaurando sem ativar o monkey patch
            originalSetItem('event_master_events', JSON.stringify(events));
            originalSetItem('event_master_participants', JSON.stringify(participants));
            originalSetItem('event_master_expenses', JSON.stringify(expenses));
            
        } catch (e) {
            console.error("Erro ao carregar da nuvem, usando cache local", e);
            events = JSON.parse(localStorage.getItem('event_master_events')) || [];
            participants = JSON.parse(localStorage.getItem('event_master_participants')) || [];
            expenses = JSON.parse(localStorage.getItem('event_master_expenses')) || [];
        }
        
        const savedEventId = localStorage.getItem('event_master_current_id');
        currentEventId = savedEventId ? parseInt(savedEventId) : (events.length > 0 ? events[0].id : null);
        
        if (!isAppInitialized) {
            init();
            isAppInitialized = true;
        } else {
            updateUIContext();
            renderDashboard();
            renderParticipantList();
            renderEvents();
        }
        
    } else {
        document.getElementById('login-container').classList.remove('hidden');
        document.getElementById('app').classList.add('hidden');
    }
});

// Elementos do DOM
const navItems = document.querySelectorAll('.nav-item');
const views = document.querySelectorAll('.view');
const viewTitle = document.getElementById('view-title');
const currentEventBadge = document.getElementById('event-context-badge');
const currentEventName = document.getElementById('current-event-name');

// Elementos do Modal de Participante
const modalOverlay = document.getElementById('modal-container');
const participantForm = document.getElementById('participant-form');
const paymentTypeSelect = document.getElementById('payment-type');
const installmentsGroup = document.getElementById('installments-group');
const openModalBtn = document.getElementById('open-register-modal');
const closeModalBtns = document.querySelectorAll('.close-modal');
const regEventSelect = document.getElementById('reg-event');
const participantModalTitle = document.getElementById('modal-title');
const participantEditId = document.getElementById('edit-participant-id');

// Elementos do Modal de Evento
const eventModalOverlay = document.getElementById('event-modal-container');
const eventForm = document.getElementById('event-form');
const openEventModalBtn = document.getElementById('open-event-modal');
const closeEventModalBtns = document.querySelectorAll('.close-event-modal');
const eventsListContainer = document.getElementById('events-list');
const eventModalTitle = eventModalOverlay.querySelector('h2');
const eventSubmitBtn = document.getElementById('event-submit-btn');
const eventEditId = document.getElementById('edit-event-id');

// Elementos do Modal de Despesa
const expenseModalOverlay = document.getElementById('expense-modal-container');
const expenseForm = document.getElementById('expense-form');
const closeExpenseModalBtns = document.querySelectorAll('.close-expense-modal');
const expenseModalTitle = document.getElementById('expense-modal-title');
const expenseEditId = document.getElementById('edit-expense-id');
const expensePaymentTypeSelect = document.getElementById('expense-payment-type');
const expenseInstallmentsGroup = document.getElementById('expense-installments-group');
const expenseStatusGroup = document.getElementById('expense-status-group');

// Inicialização
function init() {
    setupEventListeners();
    updateUIContext();
    renderDashboard();
    renderParticipantList();
    renderEvents();
    lucide.createIcons();
}

function setupEventListeners() {
    // Navegação
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const viewId = item.getAttribute('data-view');
            switchView(viewId);
        });
    });

    // Modal de Participante
    openModalBtn.addEventListener('click', () => {
        participantModalTitle.textContent = 'Cadastrar Participante';
        participantEditId.value = '';
        participantForm.reset();
        paymentTypeSelect.dispatchEvent(new Event('change'));
        populateEventSelect();

        // Pré-selecionar o evento atual
        if (currentEventId) {
            regEventSelect.value = currentEventId;
        }

        modalOverlay.classList.remove('hidden');
    });

    closeModalBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            modalOverlay.classList.add('hidden');
            participantForm.reset();
        });
    });

    paymentTypeSelect.addEventListener('change', (e) => {
        const isInstallments = e.target.value === 'installments';
        installmentsGroup.classList.toggle('hidden', !isInstallments);
        document.getElementById('installments-list-container').classList.toggle('hidden', !isInstallments);

        if (isInstallments && (!participantEditId.value || e.isTrusted)) {
            renderInstallmentsList();
        }
    });

    document.getElementById('installments').addEventListener('input', () => {
        renderInstallmentsList();
    });

    document.getElementById('price').addEventListener('input', () => {
        if (paymentTypeSelect.value === 'installments' && !participantEditId.value) {
            renderInstallmentsList();
        }
    });

    participantForm.addEventListener('submit', (e) => {
        e.preventDefault();
        saveParticipant();
    });

    // Modal de Evento
    openEventModalBtn.addEventListener('click', () => {
        eventModalTitle.textContent = 'Novo Evento';
        eventSubmitBtn.textContent = 'Criar Evento';
        eventEditId.value = '';
        eventForm.reset();
        renderEventScheduleInputs(); // Clear/Reset inputs
        eventModalOverlay.classList.remove('hidden');
    });

    closeEventModalBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            eventModalOverlay.classList.add('hidden');
            eventForm.reset();
        });
    });

    document.getElementById('event-max-installments').addEventListener('input', () => {
        renderEventScheduleInputs();
    });

    eventForm.addEventListener('submit', (e) => {
        e.preventDefault();
        saveEvent();
    });

    // Modal de Despesa
    closeExpenseModalBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            expenseModalOverlay.classList.add('hidden');
            expenseForm.reset();
        });
    });

    expensePaymentTypeSelect.addEventListener('change', (e) => {
        const isInstallments = e.target.value === 'installments';
        expenseInstallmentsGroup.classList.toggle('hidden', !isInstallments);
        document.getElementById('expense-installments-list-container').classList.toggle('hidden', !isInstallments);
        expenseStatusGroup.classList.toggle('hidden', isInstallments); // Status geral só se aplica se não for parcelado (comportamento simplificado)

        if (isInstallments && (!expenseEditId.value || e.isTrusted)) {
            renderExpenseInstallmentsList();
        }
    });

    document.getElementById('expense-installments').addEventListener('input', () => {
        renderExpenseInstallmentsList();
    });

    document.getElementById('expense-amount').addEventListener('input', () => {
        if (expensePaymentTypeSelect.value === 'installments' && !expenseEditId.value) {
            renderExpenseInstallmentsList();
        }
    });

    expenseForm.addEventListener('submit', (e) => {
        e.preventDefault();
        saveExpense();
    });

    // Busca
    document.getElementById('search-participants').addEventListener('input', (e) => {
        renderParticipantList(e.target.value);
    });

    // Exportação
    document.getElementById('export-participants').addEventListener('click', () => {
        exportParticipantsCSV();
    });

    if (document.getElementById('export-finance')) {
        document.getElementById('export-finance').addEventListener('click', () => {
            exportFinanceCSV();
        });
    }

    // Importacao
    const importInput = document.getElementById('import-csv-input');
    if (importInput) {
        importInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                importParticipantsCSV(e.target.files[0]);
                e.target.value = ''; // Reset para permitir re-importar o mesmo arquivo
            }
        });
    }
}

// Gerenciamento de Contexto
function updateUIContext() {
    const activeEvent = events.find(e => e.id === currentEventId);
    if (activeEvent) {
        currentEventBadge.classList.remove('hidden');
        currentEventName.textContent = activeEvent.name;
        document.getElementById('participant-event-name').textContent = `(Evento: ${activeEvent.name})`;
    } else {
        currentEventBadge.classList.add('hidden');
        document.getElementById('participant-event-name').textContent = '';
    }
}

function switchEvent(id) {
    currentEventId = id;
    localStorage.setItem('event_master_current_id', currentEventId);
    updateUIContext();
    renderEvents();
    renderDashboard();
    renderParticipantList();
    lucide.createIcons();
}

function switchView(viewId) {
    views.forEach(view => {
        view.classList.add('hidden');
        if (view.id === viewId) view.classList.remove('hidden');
    });

    navItems.forEach(item => {
        item.classList.toggle('active', item.getAttribute('data-view') === viewId);
    });

    const titles = {
        'dashboard': 'Painel de Controle',
        'events': 'Gestão de Eventos',
        'participants': 'Participantes',
        'reports': 'Relatórios Financeiros'
    };
    viewTitle.textContent = titles[viewId] || viewId;

    if (viewId === 'dashboard') renderDashboard();
    if (viewId === 'participants') renderParticipantList();
    if (viewId === 'events') renderEvents();
    if (viewId === 'reports') renderReports();
    lucide.createIcons();
}

// --- Lógica de Eventos e Despesas ---

function saveEvent() {
    const id = eventEditId.value;
    const maxInstallments = parseInt(document.getElementById('event-max-installments').value) || 12;

    // Capture Schedule
    const scheduleInputs = document.querySelectorAll('.event-schedule-input');
    const installmentSchedule = {}; // Map number -> date string
    scheduleInputs.forEach(input => {
        if (input.dataset.number && input.value) {
            installmentSchedule[input.dataset.number] = input.value;
        }
    });

    const eventData = {
        name: document.getElementById('event-name').value,
        date: document.getElementById('event-date').value,
        location: document.getElementById('event-location').value,
        defaultPrice: parseFloat(document.getElementById('event-price').value) || 0,
        dueDay: parseInt(document.getElementById('event-due-day').value) || null,
        maxInstallments: maxInstallments,
        installmentSchedule: installmentSchedule
    };

    if (id) {
        events = events.map(e => e.id === parseInt(id) ? { ...e, ...eventData } : e);

        // Pergunta se atualiza participantes existentes
        if (confirm("Deseja aplicar estas configurações (Valor e Calendário de Pagamento) aos participantes já cadastrados?\n\nIsso atualizará valores pendentes e datas de parcelas de acordo com a regra fixa ou dia de vencimento.")) {
            participants = participants.map(p => {
                if (p.eventId === parseInt(id)) {
                    let updatedP = { ...p };

                    const isFullyPaid = updatedP.status === 'paid';

                    if (!isFullyPaid && eventData.defaultPrice > 0) {
                        updatedP.price = eventData.defaultPrice;
                    }

                    // 2. Atualizar Datas de Parcelas
                    if (updatedP.paymentType === 'installments' && updatedP.installments) {
                        updatedP.installments = updatedP.installments.map(inst => {
                            if (inst.status === 'pending') {
                                // Prioridade: Data Fixa Específica
                                const fixedDate = eventData.installmentSchedule[inst.number];
                                if (fixedDate) {
                                    return { ...inst, dueDate: fixedDate };
                                }

                                // Fallback: Dia Vencimento Genérico
                                if (eventData.dueDay) {
                                    const currentDueDate = new Date(inst.dueDate);
                                    currentDueDate.setDate(eventData.dueDay);
                                    return { ...inst, dueDate: currentDueDate.toISOString().split('T')[0] };
                                }
                            }
                            return inst;
                        });
                    }

                    return updatedP;
                }
                return p;
            });
            localStorage.setItem('event_master_participants', JSON.stringify(participants));
        }
    } else {
        const newEvent = { id: Date.now(), ...eventData };
        events.push(newEvent);
        if (!currentEventId) currentEventId = newEvent.id;
    }

    localStorage.setItem('event_master_events', JSON.stringify(events));
    eventModalOverlay.classList.add('hidden');
    eventForm.reset();
    renderEvents();
    updateUIContext();
    lucide.createIcons();
}

function renderEventScheduleInputs(existingSchedule = null) {
    const max = parseInt(document.getElementById('event-max-installments').value) || 0;
    const container = document.getElementById('event-schedule-container');
    const list = document.getElementById('event-schedule-list');

    if (max <= 0) { // Keep hidden if 0, but show schedule if max > 0 (even 1)
        container.classList.add('hidden');
        list.innerHTML = '';
        return;
    }

    container.classList.remove('hidden');
    let html = '';

    for (let i = 1; i <= max; i++) {
        const val = existingSchedule ? (existingSchedule[i] || '') : '';
        html += `
            <div class="input-group-sm">
                <label style="font-size: 0.8rem">Parcela ${i}</label>
                <input type="date" class="event-schedule-input" data-number="${i}" value="${val}">
            </div>
        `;
    }
    list.innerHTML = html;
}

function editEvent(id, event) {
    event.stopPropagation();
    const eventToEdit = events.find(e => e.id === id);
    if (!eventToEdit) return;

    eventModalTitle.textContent = 'Editar Evento';
    eventSubmitBtn.textContent = 'Salvar Alterações';
    eventEditId.value = id;
    document.getElementById('event-name').value = eventToEdit.name;
    document.getElementById('event-date').value = eventToEdit.date;
    document.getElementById('event-location').value = eventToEdit.location;
    document.getElementById('event-price').value = eventToEdit.defaultPrice || '';
    document.getElementById('event-due-day').value = eventToEdit.dueDay || '';
    document.getElementById('event-max-installments').value = eventToEdit.maxInstallments || '';

    // Render Schedule
    renderEventScheduleInputs(eventToEdit.installmentSchedule);

    eventModalOverlay.classList.remove('hidden');
}

function deleteEvent(id, event) {
    event.stopPropagation();
    if (confirm('Tem certeza que deseja excluir este evento? Todos os participantes vinculados também serão removidos.')) {
        events = events.filter(e => e.id !== id);
        participants = participants.filter(p => p.eventId !== id);
        expenses = expenses.filter(e => e.eventId !== id); // Remove despesas também

        if (currentEventId === id) {
            currentEventId = events.length > 0 ? events[0].id : null;
            localStorage.setItem('event_master_current_id', currentEventId);
        }

        localStorage.setItem('event_master_events', JSON.stringify(events));
        localStorage.setItem('event_master_participants', JSON.stringify(participants));
        localStorage.setItem('event_master_expenses', JSON.stringify(expenses));

        renderEvents();
        updateUIContext();
        renderDashboard();
        renderParticipantList();
        lucide.createIcons();
    }
}

function renderEvents() {
    eventsListContainer.innerHTML = events.map(event => {
        const eventParticipants = participants.filter(p => p.eventId === event.id);
        const revenue = eventParticipants.reduce((sum, p) => sum + (p.status === 'paid' ? p.price : (p.paidAmount || 0)), 0);

        const eventExpenses = expenses.filter(e => e.eventId === event.id);
        const totalExpenses = eventExpenses.reduce((sum, e) => sum + e.amount, 0); // Gastos Totais
        const isActive = event.id === currentEventId;

        return `
            <div class="event-card ${isActive ? 'active' : ''}" onclick="switchEvent(${event.id})">
                <div class="event-header">
                    <h3>${event.name}</h3>
                    <div class="card-actions">
                         <button class="icon-btn" onclick="openExpenseModal(${event.id}, event)" title="Lançar Gasto">
                             <i data-lucide="minus-circle" style="color:red"></i>
                        </button>
                        <button class="icon-btn" onclick="editEvent(${event.id}, event)" title="Editar Evento">
                             <i data-lucide="edit-3"></i>
                        </button>
                        <button class="icon-btn" onclick="deleteEvent(${event.id}, event)" title="Excluir Evento" style="color: var(--error);">
                             <i data-lucide="trash"></i>
                        </button>
                    </div>
                </div>
                <div class="event-info-item">
                    <i data-lucide="calendar" style="width: 16px;"></i> ${new Date(event.date + 'T00:00:00').toLocaleDateString('pt-BR')}
                </div>
                <div class="event-info-item">
                    <i data-lucide="map-pin" style="width: 16px;"></i> ${event.location}
                </div>
                <div class="event-stats">
                    <div class="stat-info">
                        <span class="stat-label">Receita</span>
                        <strong>R$ ${revenue.toFixed(2).replace('.', ',')}</strong>
                    </div>
                     <div class="stat-info">
                        <span class="stat-label">Gastos</span>
                        <strong style="color:var(--error)">R$ ${totalExpenses.toFixed(2).replace('.', ',')}</strong>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    lucide.createIcons();
}

function populateEventSelect() {
    regEventSelect.innerHTML = events.map(e =>
        `<option value="${e.id}">${e.name}</option>`
    ).join('');
}

// --- Lógica de Despesas ---

function openExpenseModal(eventId, eventObj) {
    if (eventObj) eventObj.stopPropagation();
    expenseModalTitle.textContent = 'Novo Gasto';
    expenseEditId.value = '';
    expenseForm.reset();

    // Armazena o ID do evento alvo no form (usando dataset ou variável global temporária, 
    // mas vamos usar o currentEventId se clicado fora, ou forçar o currentEventId)
    // Melhor: se clicou no botão do card, mudar o evento ativo?
    // Ou simplesmente gravar qual evento é. Vamos assumir que sempre grava no evento ATIVO
    // SE o switchEvent não tiver sido chamado. Mas switchEvent É chamado ao clicar no card.
    // O stopPropagation inibe. Então precisamos garantir que o gasto vá pro evento certo.
    // Vamos usar um atributo customizado no form ou variável global.
    window.tempExpenseEventId = eventId;

    expensePaymentTypeSelect.dispatchEvent(new Event('change'));
    expenseModalOverlay.classList.remove('hidden');
}

function saveExpense() {
    const id = expenseEditId.value;
    const eventId = window.tempExpenseEventId || currentEventId;
    const paymentType = expensePaymentTypeSelect.value;
    const installmentsData = [];

    if (paymentType === 'installments') {
        const installmentItems = document.querySelectorAll('.expense-installment-item'); // Nova classe pra diferenciar?
        // Reutilizar lógica ou criar específica. Melhor específica para evitar conflito de seletores.
        // Vamos assumir que renderExpenseInstallmentsList usa classes parecidas mas em outro container.
        const container = document.getElementById('expense-installments-list');
        const items = container.querySelectorAll('.installment-item');

        items.forEach(item => {
            installmentsData.push({
                number: parseInt(item.dataset.number),
                value: parseFloat(item.querySelector('.inst-total').value) || 0,
                status: item.querySelector('.inst-status').checked ? 'paid' : 'pending',
                dueDate: item.querySelector('.inst-due-date').value,
                paymentDate: item.querySelector('.inst-date').value // opcional se pago
            });
        });
    }

    const amount = parseFloat(document.getElementById('expense-amount').value) || 0;
    const status = document.getElementById('expense-status').value;

    const expenseData = {
        eventId: eventId,
        description: document.getElementById('expense-desc').value,
        amount: amount,
        date: document.getElementById('expense-date').value,
        paymentType: paymentType,
        status: paymentType === 'installments' ? 'partial' : status, // status geral
        installments: installmentsData,
        // Calc paid
        paidAmount: paymentType === 'installments'
            ? installmentsData.reduce((acc, i) => acc + (i.status === 'paid' ? i.value : 0), 0)
            : (status === 'paid' ? amount : 0)
    };

    if (id) {
        expenses = expenses.map(e => e.id === parseInt(id) ? { ...e, ...expenseData } : e);
    } else {
        expenses.push({ id: Date.now(), ...expenseData });
    }

    localStorage.setItem('event_master_expenses', JSON.stringify(expenses));
    expenseModalOverlay.classList.add('hidden');
    expenseForm.reset();
    renderDashboard();
    renderEvents(); // Atualizar card
}

function renderExpenseInstallmentsList(existingData = null) {
    const count = parseInt(document.getElementById('expense-installments').value) || 2;
    const price = parseFloat(document.getElementById('expense-amount').value) || 0;
    const container = document.getElementById('expense-installments-list');

    // Mesmo padrão de renderInstallmentsList, mas adaptado para despesa (sem whatsapp, sem transfer)
    // E input de status paid/pending.

    const valuePerInstallment = (price / count).toFixed(2);
    let html = '';

    for (let i = 1; i <= count; i++) {
        const data = existingData ? existingData.find(d => d.number === i) : null;
        const val = data ? data.value : valuePerInstallment;
        const status = data ? data.status : 'pending';
        const date = data ? data.paymentDate : '';
        let dueDate = data ? data.dueDate : '';

        if (!dueDate) {
            const today = new Date();
            const d = new Date(today.getFullYear(), today.getMonth() + (i - 1), today.getDate());
            dueDate = d.toISOString().split('T')[0];
        }

        html += `
            <div class="installment-item" data-number="${i}">
                <div class="inst-info">
                    <span>#${i}</span>
                    <div class="inst-values">
                         <div class="input-inline">
                            <label>Valor: R$</label>
                            <input type="number" class="inst-total" value="${val}" step="0.01">
                        </div>
                    </div>
                </div>
                 <div class="inst-dates">
                    <div class="input-inline">
                        <label>Vencimento:</label>
                        <input type="date" class="inst-due-date" value="${dueDate}">
                    </div>
                    <div class="input-inline">
                        <label>Pgto:</label>
                        <input type="date" class="inst-date" value="${date}">
                    </div>
                </div>
                <div class="installment-controls">
                    <label class="switch-mini">
                        <input type="checkbox" class="inst-status" ${status === 'paid' ? 'checked' : ''}>
                        <span class="slider-mini"></span>
                    </label>
                    <span style="font-size:0.8rem">${status === 'paid' ? 'Pago' : 'Pendente'}</span>
                </div>
            </div>
         `;
    }
    container.innerHTML = html;

    // Listener para atualização em cascata das datas de vencimento
    const dateInputs = container.querySelectorAll('.inst-due-date');
    dateInputs.forEach((input, index) => {
        input.addEventListener('change', (e) => {
            const newDateStr = e.target.value;
            if (!newDateStr) return;
            // Parse considerando o fuso horário local para evitar desvios
            const [year, month, day] = newDateStr.split('-').map(Number);
            
            for (let j = index + 1; j < dateInputs.length; j++) {
                const nextInput = dateInputs[j];
                const nextDate = new Date(year, month - 1 + (j - index), day);
                nextInput.value = nextDate.toISOString().split('T')[0];
            }
        });
    });
}

// --- Lógica de Participantes ---

function saveParticipant() {
    const id = participantEditId.value;
    const paymentType = paymentTypeSelect.value;
    const installmentsData = [];

    // Coleta dados das parcelas se for parcelado
    if (paymentType === 'installments') {
        const installmentItems = document.querySelectorAll('#installments-list .installment-item');
        installmentItems.forEach(item => {
            installmentsData.push({
                number: parseInt(item.dataset.number),
                totalValue: parseFloat(item.querySelector('.inst-total').value) || 0,
                paidValue: parseFloat(item.querySelector('.inst-paid').value) || 0,
                dueDate: item.querySelector('.inst-due-date').value,
                paymentDate: item.querySelector('.inst-date').value,
                status: item.querySelector('.inst-status').checked ? 'paid' : 'pending'
            });
        });
    }

    const participantData = {
        eventId: parseInt(regEventSelect.value),
        name: document.getElementById('name').value,
        email: document.getElementById('email').value,
        phone: document.getElementById('phone').value,
        price: parseFloat(document.getElementById('price').value) || 0,
        paymentType: paymentType,
        paymentDate: document.getElementById('payment-date').value,
        paymentMethod: document.getElementById('payment-method').value,
        obs: document.getElementById('payment-obs').value,
        status: document.getElementById('status').value,
        confirmation: document.getElementById('confirmation').value,
        installments: paymentType === 'installments' ? installmentsData : [],
        paidAmount: paymentType === 'installments'
            ? installmentsData.reduce((acc, inst) => acc + inst.paidValue, 0)
            : (document.getElementById('status').value === 'paid' ? parseFloat(document.getElementById('price').value) : 0)
    };

    if (id) {
        // Update
        participants = participants.map(p => p.id === parseInt(id) ? { ...p, ...participantData, id: parseInt(id) } : p);
    } else {
        // Create
        participants.push({ id: Date.now(), ...participantData });
    }

    localStorage.setItem('event_master_participants', JSON.stringify(participants));
    modalOverlay.classList.add('hidden');
    participantForm.reset();
    renderParticipantList();
    renderDashboard(); // Atualizar stats
    updateUIContext();
    lucide.createIcons();
}

// Bulk Selection State
let selectedParticipantIds = new Set();

function renderParticipantList(filterText = '') {
    const tbody = document.querySelector('#participants-table tbody');
    if (!tbody) return;

    // Filtra por evento ativo e busca de texto
    const filtered = participants.filter(p => {
        const matchesEvent = currentEventId ? p.eventId === currentEventId : true;
        const matchesSearch = p.name.toLowerCase().includes(filterText.toLowerCase()) ||
            (p.email && p.email.toLowerCase().includes(filterText.toLowerCase()));
        return matchesEvent && matchesSearch;
    });

    tbody.innerHTML = filtered.map(p => {
        const statusClass = p.status === 'paid' ? 'status-paid' : 'status-pending';
        const statusLabel = p.status === 'paid' ? 'Pago' : 'Pendente';
        let paymentInfo = '';
        const isSelected = selectedParticipantIds.has(p.id) ? 'checked' : '';

        if (p.paymentType === 'installments' && p.installments) {
            const paidInst = p.installments.filter(i => i.status === 'paid').length;
            const totalInst = p.installments.length;
            paymentInfo = `<span class="badge" style="background:var(--bg-secondary)">${paidInst}/${totalInst} Parc.</span>`;
        } else {
            paymentInfo = p.paymentMethod || '-';
        }

        const confMap = {
            'yes': { label: 'Sim', class: 'status-paid' },
            'no': { label: 'Não', class: 'status-error' },
            'maybe': { label: 'Talvez', class: 'status-pending' },
            'pending': { label: 'Pendente', class: 'status-secondary' },
            'later': { label: 'Confirmar Depois', class: 'status-secondary' }
        };
        const conf = confMap[p.confirmation || 'later'] || confMap['later'];

        return `
            <tr class="${isSelected ? 'selected-row' : ''}">
                <td style="text-align: center;">
                    <input type="checkbox" class="participant-select-check" data-id="${p.id}" ${isSelected}>
                </td>
                <td>
                    <div class="user-cell">
                        <div class="avatar-sm">${p.name.charAt(0).toUpperCase()}</div>
                        <div>
                            <div class="font-medium">${p.name}</div>
                            <div class="text-sm text-muted">${p.email || ''}</div>
                        </div>
                    </div>
                </td>
                <td>${p.phone || '-'}</td>
                <td>${paymentInfo}</td>
                <td>R$ ${p.price.toFixed(2).replace('.', ',')}</td>
                <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
                <td><span class="status-badge ${conf.class}">${conf.label}</span></td>
                <td>
                    <div class="action-buttons">
                        <button class="icon-btn" onclick="editParticipant(${p.id})" title="Editar">
                            <i data-lucide="edit-2"></i>
                        </button>
                        <button class="icon-btn" onclick="deleteParticipant(${p.id})" title="Excluir" style="color:var(--error)">
                            <i data-lucide="trash-2"></i>
                        </button>
                        <button class="icon-btn whatsapp-btn" onclick="sendWhatsApp(${p.id})" title="Enviar WhatsApp">
                             <i data-lucide="message-circle"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    // Checkbox Listeners
    document.querySelectorAll('.participant-select-check').forEach(chk => {
        chk.addEventListener('change', (e) => {
            const id = parseInt(e.target.dataset.id);
            if (e.target.checked) selectedParticipantIds.add(id);
            else selectedParticipantIds.delete(id);
            updateBulkActionsUI();
        });
    });

    // Select All Logic update
    const selectAll = document.getElementById('select-all-participants');
    if (selectAll) {
        // Simple check if all visible are selected
        const allVisibleIds = filtered.map(p => p.id);
        const allSelected = allVisibleIds.length > 0 && allVisibleIds.every(id => selectedParticipantIds.has(id));
        selectAll.checked = allSelected;

        // Remove old listener to avoid dupes? Better to just re-attach or handle outside.
        // Let's handle outside or ensure idempotent.
        if (!selectAll.hasAttribute('data-listener')) {
            selectAll.addEventListener('change', (e) => {
                const isChecked = e.target.checked;
                const visible = participants.filter(p => {
                    const matchesEvent = currentEventId ? p.eventId === currentEventId : true;
                    const matchesSearch = p.name.toLowerCase().includes(document.getElementById('search-participants').value.toLowerCase()) ||
                        (p.email && p.email.toLowerCase().includes(document.getElementById('search-participants').value.toLowerCase()));
                    return matchesEvent && matchesSearch;
                });

                visible.forEach(p => {
                    if (isChecked) selectedParticipantIds.add(p.id);
                    else selectedParticipantIds.delete(p.id);
                });
                renderParticipantList(document.getElementById('search-participants').value);
                updateBulkActionsUI();
            });
            selectAll.setAttribute('data-listener', 'true');
        }
    }

    updateBulkActionsUI();

    lucide.createIcons();
}

function editParticipant(id) {
    const p = participants.find(part => part.id === id);
    if (!p) return;

    participantModalTitle.textContent = 'Editar Participante';
    participantEditId.value = p.id;
    populateEventSelect();

    // Preenche campos
    regEventSelect.value = p.eventId;
    document.getElementById('name').value = p.name;
    document.getElementById('email').value = p.email || '';
    document.getElementById('phone').value = p.phone || '';
    document.getElementById('price').value = p.price;
    document.getElementById('payment-date').value = p.paymentDate || '';
    document.getElementById('payment-method').value = p.paymentMethod || '';
    document.getElementById('payment-obs').value = p.obs || '';
    document.getElementById('status').value = p.status;
    document.getElementById('confirmation').value = p.confirmation || 'later';

    paymentTypeSelect.value = p.paymentType;
    // Dispara evento para mostrar/ocultar campos de parcela
    paymentTypeSelect.dispatchEvent(new Event('change'));

    if (p.paymentType === 'installments') {
        document.getElementById('installments').value = p.installments.length;
        renderInstallmentsList(p.installments);
    }

    modalOverlay.classList.remove('hidden');
}

function deleteParticipant(id) {
    if (confirm('Tem certeza que deseja excluir este participante?')) {
        participants = participants.filter(p => p.id !== id);
        localStorage.setItem('event_master_participants', JSON.stringify(participants));
        renderParticipantList();
        renderDashboard();
        updateUIContext();
    }
}

function updateStatus(id, newStatus) {
    participants = participants.map(p => p.id === id ? { ...p, status: newStatus } : p);
    localStorage.setItem('event_master_participants', JSON.stringify(participants));
    renderParticipantList();
    renderDashboard();
}

// --- Dashboard e Relatórios ---

function renderDashboard() {
    // Filtra participantes e despesas do evento atual
    const contextParticipants = currentEventId
        ? participants.filter(p => p.eventId === currentEventId)
        : participants;
    const contextExpenses = currentEventId
        ? expenses.filter(e => e.eventId === currentEventId)
        : expenses;

    const totalParticipants = contextParticipants.length;
    // Receita Total (Entradas reais)
    const totalReceived = contextParticipants.reduce((sum, p) => sum + (p.paidAmount || (p.status === 'paid' ? p.price : 0)), 0);
    // Total Previsto (Soma dos preços dos participantes)
    const totalProjected = contextParticipants.reduce((sum, p) => sum + p.price, 0);
    // A Receber
    const pendingRevenue = totalProjected - totalReceived;

    // Gastos Totais (Previsto)
    const totalExpensesProjected = contextExpenses.reduce((sum, e) => sum + e.amount, 0);
    // Gastos Pagos (Saídas reais)
    const totalExpensesPaid = contextExpenses.reduce((sum, e) => sum + (e.paidAmount || 0), 0);

    // Lucro Líquido = Receita Real - Gastos Reais (Caixa Atual)
    const netProfit = totalReceived - totalExpensesPaid;

    const pendingCount = contextParticipants.filter(p => p.status === 'pending' || (p.installments && p.installments.some(i => i.status === 'pending'))).length;

    // Atualiza Stats Cards
    if (document.getElementById('stat-total-participants'))
        document.getElementById('stat-total-participants').textContent = totalParticipants;
    if (document.getElementById('stat-total-revenue'))
        document.getElementById('stat-total-revenue').textContent = `R$ ${totalReceived.toFixed(2).replace('.', ',')}`;
    // Mostra Gastos Pagos no dashboard principal ou Gasto Total? Geralmente fluxo de caixa mostra realizado.
    // Vamos mostrar Total Gastos (Realizado)
    if (document.getElementById('stat-total-expenses'))
        document.getElementById('stat-total-expenses').textContent = `R$ ${totalExpensesPaid.toFixed(2).replace('.', ',')}`;
    if (document.getElementById('stat-net-profit')) {
        document.getElementById('stat-net-profit').textContent = `R$ ${netProfit.toFixed(2).replace('.', ',')}`;
        document.getElementById('stat-net-profit').parentElement.parentElement.querySelector('.stat-icon').className = `stat-icon ${netProfit >= 0 ? 'blue' : 'red'}`;
    }

    if (document.getElementById('stat-pending-revenue'))
        document.getElementById('stat-pending-revenue').textContent = `R$ ${pendingRevenue.toFixed(2).replace('.', ',')}`;
    if (document.getElementById('stat-pending'))
        document.getElementById('stat-pending').textContent = pendingCount;

    // Tabela de Atividades Recentes (Últimos 5 cadastros ou pagamentos)
    // Ordena por data de criação (simulada pelo ID timestamp)
    const recent = [...participants].sort((a, b) => b.id - a.id).slice(0, 5);
    const recentTableBody = document.querySelector('#recent-table tbody');
    if (recentTableBody) {
        recentTableBody.innerHTML = recent.map(p => `
            <tr>
                <td>${p.id}</td> <!-- Usando ID como 'Protocolo' simplificado -->
                <td>${p.name}</td>
                <td>${new Date(p.paymentDate || p.id).toLocaleDateString('pt-BR')}</td>
                <td>R$ ${p.price.toFixed(2).replace('.', ',')}</td>
                <td><span class="status-badge ${p.status === 'paid' ? 'status-paid' : 'status-pending'}">${p.status === 'paid' ? 'Pago' : 'Pendente'}</span></td>
            </tr>
        `).join('');
    }
}

function renderReports() {
    const contextParticipants = currentEventId
        ? participants.filter(p => p.eventId === currentEventId)
        : participants;

    const totalProjected = contextParticipants.reduce((sum, p) => sum + p.price, 0);
    const totalReceived = contextParticipants.reduce((sum, p) => sum + (p.paidAmount || (p.status === 'paid' ? p.price : 0)), 0);
    const avgTicket = contextParticipants.length ? (totalProjected / contextParticipants.length) : 0;

    document.getElementById('report-total-projected').textContent = `R$ ${totalProjected.toFixed(2).replace('.', ',')}`;
    document.getElementById('report-total-received').textContent = `R$ ${totalReceived.toFixed(2).replace('.', ',')}`;
    document.getElementById('report-avg-ticket').textContent = `R$ ${avgTicket.toFixed(2).replace('.', ',')}`;

    // Gráfico/Stats de Métodos de Pagamento
    const methodCounts = {};
    contextParticipants.forEach(p => {
        const method = p.paymentMethod || 'Não definido';
        methodCounts[method] = (methodCounts[method] || 0) + 1;
    });

    const methodStatsContainer = document.getElementById('method-stats');
    if (methodStatsContainer) {
        methodStatsContainer.innerHTML = Object.entries(methodCounts).map(([method, count]) => `
            <div class="method-stat-item">
                <span class="method-name">${method}</span>
                <span class="method-count">${count}</span>
                <div class="progress-bar-bg">
                    <div class="progress-bar-fill" style="width: ${(count / contextParticipants.length) * 100}%"></div>
                </div>
            </div>
        `).join('');
    }

    // Extrato Detalhado (Simplificado, mostra todas as entradas)
    // Se fosse mais complexo, quebraria as parcelas pagas em linhas individuais
    const extractTableBody = document.querySelector('#financial-extract-table tbody');
    if (extractTableBody) {
        let extractRows = [];
        contextParticipants.forEach(p => {
            if (p.paymentType === 'installments' && p.installments) {
                p.installments.forEach(inst => {
                    if (inst.status === 'paid') {
                        extractRows.push({
                            date: inst.paymentDate || '-',
                            name: p.name,
                            desc: `Parc. ${inst.number}`,
                            value: inst.paidValue,
                            method: p.paymentMethod
                        });
                    }
                });
            } else if (p.status === 'paid') {
                extractRows.push({
                    date: p.paymentDate || '-',
                    name: p.name,
                    desc: 'Pagamento Único',
                    value: p.price,
                    method: p.paymentMethod
                });
            }
        });

        // Ordena por data (opcional, aqui sem date parsing robusto pode falhar ordenação correta)
        extractTableBody.innerHTML = extractRows.map(row => `
            <tr>
                <td>${row.date}</td>
                <td>${row.name}</td>
                <td>${row.desc}</td>
                <td>R$ ${row.value.toFixed(2).replace('.', ',')}</td>
                <td>${row.method || '-'}</td>
            </tr>
        `).join('');
    }
}

// --- Utilitários e Helpers ---

function transferRemainder(installmentIndex) {
    const currentItem = document.querySelector(`.installment-item[data-number="${installmentIndex}"]`);
    const nextItem = document.querySelector(`.installment-item[data-number="${installmentIndex + 1}"]`);

    if (!currentItem || !nextItem) return;

    const currentTotal = parseFloat(currentItem.querySelector('.inst-total').value) || 0;
    const currentPaid = parseFloat(currentItem.querySelector('.inst-paid').value) || 0;

    // Se pagou menos que o total, a diferença vai pro próximo
    if (currentPaid < currentTotal) {
        const remainder = currentTotal - currentPaid;
        const nextTotalInput = nextItem.querySelector('.inst-total');
        const currentNextTotal = parseFloat(nextTotalInput.value) || 0;

        nextTotalInput.value = (currentNextTotal + remainder).toFixed(2);

        // Ajusta o atual para refletir que o total agora é o que foi pago (fechando a conta dessa parcela)
        // Opcional: ou mantém o total original e mostra pendência. 
        // Aqui vamos assumir que transfere a dívida:
        currentItem.querySelector('.inst-total').value = currentPaid.toFixed(2);

        alert(`R$ ${remainder.toFixed(2).replace('.', ',')} transferidos para a próxima parcela.`);
    } else {
        alert('Esta parcela já está totalmente paga ou paga a maior.');
    }
}

// Funções de Auxílio - Parcelas
function renderInstallmentsList(existingData = null) {
    const count = parseInt(document.getElementById('installments').value) || 2;
    const price = parseFloat(document.getElementById('price').value) || 0;
    const container = document.getElementById('installments-list');
    const listWrapper = document.getElementById('installments-list-container');

    if (paymentTypeSelect.value !== 'installments') {
        listWrapper.classList.add('hidden');
        return;
    }

    listWrapper.classList.remove('hidden');
    const valuePerInstallment = (price / count).toFixed(2);

    const eventId = participantEditId.value
        ? participants.find(p => p.id == participantEditId.value)?.eventId
        : regEventSelect.value;
    const eventObj = events.find(e => e.id == eventId);
    const dueDay = eventObj ? eventObj.dueDay : null;
    const fixedSchedule = eventObj ? eventObj.installmentSchedule : null;

    let html = '';

    // Base Date Calculation
    const today = new Date();
    let startYear = today.getFullYear();
    let startMonth = today.getMonth(); // 0-11

    // If dueDay is set, check if we missed it this month
    if (dueDay && today.getDate() > dueDay) {
        startMonth++; // Move to next month
    }

    for (let i = 1; i <= count; i++) {
        const data = existingData ? existingData.find(d => d.number === i) : null;
        let dueDate = data ? data.dueDate : '';

        // Calculate dynamic due date if not set
        if (!dueDate) {
            // Check for Fixed Schedule First
            if (fixedSchedule && fixedSchedule[i]) {
                dueDate = fixedSchedule[i];
            }
            // Fallback to Periodic Due Day ou Data Atual
            else {
                const dayToUse = dueDay || today.getDate();
                const d = new Date(startYear, startMonth + (i - 1), dayToUse);
                dueDate = d.toISOString().split('T')[0];
            }
        }

        const totalVal = data ? data.totalValue : valuePerInstallment;
        const paidVal = data ? data.paidValue : (data && data.status === 'paid' ? totalVal : 0);
        const status = data ? data.status : 'pending';
        const date = data ? data.paymentDate : '';

        // Verificar se está atraada
        const isOverdue = status === 'pending' && dueDate && new Date(dueDate) < new Date(new Date().setHours(0, 0, 0, 0));

        html += `
            <div class="installment-item ${isOverdue ? 'overdue-item' : ''}" data-number="${i}">
                <div class="inst-info">
                    <span>#${i} ${isOverdue ? '<span class="overdue-label">ATRASADA</span>' : ''}</span>
                    <div class="inst-values">
                         <div class="input-inline">
                            <label>Total: R$</label>
                            <input type="number" class="inst-total" value="${totalVal}" step="0.01">
                        </div>
                        <div class="input-inline">
                            <label>Pago: R$</label>
                            <input type="number" class="inst-paid" value="${paidVal}" step="0.01">
                        </div>
                    </div>
                </div>
                <div class="inst-dates">
                    <div class="input-inline">
                        <label>Vencimento:</label>
                        <input type="date" class="inst-due-date" value="${dueDate}">
                    </div>
                    <div class="input-inline">
                        <label>Pagamento:</label>
                        <input type="date" class="inst-date" value="${date}" title="Data do Pagamento">
                    </div>
                </div>
                <div class="installment-controls">
                    ${status === 'paid' ? `
                        <button type="button" class="icon-btn whatsapp-btn" onclick="sendInstallmentWhatsApp(${i})" title="Enviar confirmação desta parcela">
                            <i data-lucide="message-circle"></i>
                        </button>
                    ` : ''}
                    ${i < count ? `
                        <button type="button" class="icon-btn transfer-btn" onclick="transferRemainder(${i})" title="Jogar restante para a próxima">
                            <i data-lucide="arrow-down-right"></i>
                        </button>
                    ` : ''}
                    <label class="switch-mini">
                        <input type="checkbox" class="inst-status" ${status === 'paid' ? 'checked' : ''} onchange="togglePaidStatus(${i}, this)">
                        <span class="slider-mini"></span>
                    </label>
                </div>
            </div>
        `;
    }
    container.innerHTML = html;
    
    // Listener para atualização em cascata das datas de vencimento
    const dateInputs = container.querySelectorAll('.inst-due-date');
    dateInputs.forEach((input, index) => {
        input.addEventListener('change', (e) => {
            const newDateStr = e.target.value;
            if (!newDateStr) return;
            
            const [year, month, day] = newDateStr.split('-').map(Number);
            
            for (let j = index + 1; j < dateInputs.length; j++) {
                const nextInput = dateInputs[j];
                const nextDate = new Date(year, month - 1 + (j - index), day);
                nextInput.value = nextDate.toISOString().split('T')[0];
            }
        });
    });

    lucide.createIcons();
}

function togglePaidStatus(number, checkbox) {
    const item = document.querySelector(`.installment-item[data-number="${number}"]`);
    const totalInput = item.querySelector('.inst-total');
    const paidInput = item.querySelector('.inst-paid');
    const controls = item.querySelector('.installment-controls');

    if (checkbox.checked) {
        paidInput.value = totalInput.value;

        // Adicionar botão do WhatsApp se não existir
        if (!item.querySelector('.whatsapp-btn')) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'icon-btn whatsapp-btn';
            btn.title = 'Enviar confirmação desta parcela';
            btn.onclick = () => sendInstallmentWhatsApp(number);
            btn.innerHTML = '<i data-lucide="message-circle"></i>';

            // Inserir no início dos controles (antes do switch ou botão de transferência)
            controls.insertBefore(btn, controls.firstChild);
            lucide.createIcons();
        }
    } else {
        // Remover botão e resetar valor pago (opcional, mas prático)
        const btn = item.querySelector('.whatsapp-btn');
        if (btn) btn.remove();
        paidInput.value = '0.00';
    }
}

function sendInstallmentWhatsApp(installmentNumber) {
    // Pegar dados diretamente do formulário para permitir envio sem salvar
    const name = document.getElementById('name').value;
    const phone = document.getElementById('phone').value;
    const eventId = document.getElementById('reg-event').value;

    // Buscar evento selecionado
    const event = events.find(e => e.id == eventId);

    if (!phone) {
        alert("Por favor, preencha o telefone do participante.");
        return;
    }

    // Buscar dados da parcela na tela
    const item = document.querySelector(`.installment-item[data-number="${installmentNumber}"]`);
    if (!item) return;

    const value = parseFloat(item.querySelector('.inst-paid').value) || 0;

    let cleanPhone = phone.replace(/\D/g, '');
    if (!cleanPhone.startsWith('55') && cleanPhone.length <= 11) {
        cleanPhone = '55' + cleanPhone;
    }

    const eventName = event ? event.name : 'Evento';
    const message = `Olá *${name}*! 👋\n\nConfirmamos o pagamento da *Parcela #${installmentNumber}* no valor de *R$ ${value.toFixed(2).replace('.', ',')}* referentes ao evento *${eventName}*.\n\nObrigado! 😊`;

    window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`, '_blank');
}

function sendWhatsApp(participantId) {
    const p = participants.find(part => part.id === participantId);
    if (!p || !p.phone) return;

    let cleanPhone = p.phone.replace(/\D/g, '');
    if (!cleanPhone.startsWith('55') && cleanPhone.length <= 11) {
        cleanPhone = '55' + cleanPhone;
    }

    const message = `Olá *${p.name}*! 👋\n\nEstamos entrando em contato referente ao seu registro no evento.\n\nQualquer dúvida, estamos à disposição!`;
    window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`, '_blank');
}

function exportParticipantsCSV() {
    const contextParticipants = currentEventId
        ? participants.filter(p => p.eventId === currentEventId)
        : participants;

    if (contextParticipants.length === 0) {
        alert("Não há participantes para exportar.");
        return;
    }

    // Adiciona o BOM para o Excel entender UTF-8 com acentos corretamente
    let csvContent = "\uFEFF";
    csvContent += "Nome;Email;Telefone;Forma de Pagamento;Parcelas;Valor Total;Valor Pago;Status;Confirmação;Observações\n";

    const statusMap = {
        'paid': 'Pago',
        'pending': 'Pendente'
    };

    const confMap = {
        'yes': 'Sim',
        'no': 'Não',
        'maybe': 'Talvez',
        'pending': 'Pendente',
        'later': 'Confirmar Depois'
    };

    contextParticipants.forEach(p => {
        // Formatação do nome (removendo ponto e vírgula para não quebrar o CSV)
        const name = (p.name || '').replace(/;/g, ',');
        const email = (p.email || '').replace(/;/g, ',');
        const phone = (p.phone || '').replace(/;/g, ',');
        const paymentMethod = p.paymentType === 'installments' ? 'Parcelado' : (p.paymentMethod || 'À vista');

        let parcelasInfo = '1/1';
        if (p.paymentType === 'installments' && p.installments) {
            const paidInst = p.installments.filter(i => i.status === 'paid').length;
            const totalInst = p.installments.length;
            parcelasInfo = `${paidInst}/${totalInst}`;
        }

        const priceFormat = p.price ? p.price.toFixed(2).replace('.', ',') : '0,00';
        const paidFormat = p.paidAmount ? p.paidAmount.toFixed(2).replace('.', ',') : '0,00';
        const status = statusMap[p.status] || 'Desconhecido';
        const confirmation = confMap[p.confirmation || 'later'] || 'Confirmar Depois';
        const obs = (p.obs || '').replace(/(\r\n|\n|\r)/gm, " ").replace(/;/g, ','); // Remove quebras de linha e ponto e vírgula

        // Usando ponto e vírgula (;) como delimitador, o padrão no Excel em português
        const row = `"${name}";"${email}";"${phone}";"${paymentMethod}";"${parcelasInfo}";"${priceFormat}";"${paidFormat}";"${status}";"${confirmation}";"${obs}"`;
        csvContent += row + "\n";
    });

    // Usa um blob para forçar a codificação e evitar problemas de caracteres estranhos
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.setAttribute("href", url);
    link.setAttribute("download", `participantes_evento_${currentEventId || 'todos'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function exportFinanceCSV() {
    const contextParticipants = currentEventId
        ? participants.filter(p => p.eventId === currentEventId)
        : participants;

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Data,Participante,Descricao,Valor,Metodo\n";

    contextParticipants.forEach(p => {
        if (p.paymentType === 'installments' && p.installments) {
            p.installments.forEach(inst => {
                if (inst.status === 'paid') {
                    csvContent += `${inst.paymentDate || ''},${p.name},Parc. ${inst.number},${inst.paidValue},${p.paymentMethod}\n`;
                }
            });
        } else if (p.status === 'paid') {
            csvContent += `${p.paymentDate || ''},${p.name},Pagamento Unico,${p.price},${p.paymentMethod}\n`;
        }
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "financeiro.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// --- Bulk Actions Logic ---

function updateBulkActionsUI() {
    const bar = document.getElementById('bulk-actions-bar');
    const countSpan = document.getElementById('selection-count');

    if (selectedParticipantIds.size > 0) {
        bar.classList.remove('hidden');
        countSpan.textContent = `${selectedParticipantIds.size} selecionados`;
    } else {
        bar.classList.add('hidden');
    }
}

// Bulk Modal Elements
const bulkModalContainer = document.getElementById('bulk-edit-modal-container');
const openBulkModalBtn = document.getElementById('open-bulk-modal');
const closeBulkModalBtn = document.querySelector('.close-bulk-modal');
const bulkForm = document.getElementById('bulk-edit-form');

// Inputs
const bulkApplyInstallments = document.getElementById('bulk-apply-installments');
const bulkUpdateStatusCheck = document.getElementById('bulk-update-status-check');
const bulkStatusSelect = document.getElementById('bulk-status');
const bulkUpdateDateCheck = document.getElementById('bulk-update-date-check');
const bulkDateInput = document.getElementById('bulk-payment-date');
const bulkUpdateMethodCheck = document.getElementById('bulk-update-method-check');
const bulkMethodSelect = document.getElementById('bulk-payment-method');
const bulkPayInstallmentCheck = document.getElementById('bulk-pay-installment-check');
const bulkInstallmentInputs = document.getElementById('bulk-installment-inputs');
const bulkInstallmentNumber = document.getElementById('bulk-installment-number');
const bulkInstallmentDate = document.getElementById('bulk-installment-date');
const bulkUpdateConfirmationCheck = document.getElementById('bulk-update-confirmation-check');
const bulkConfirmationSelect = document.getElementById('bulk-confirmation');

// Toggle Visibility
if (bulkUpdateStatusCheck) bulkUpdateStatusCheck.addEventListener('change', (e) => bulkStatusSelect.classList.toggle('hidden', !e.target.checked));
if (bulkUpdateDateCheck) bulkUpdateDateCheck.addEventListener('change', (e) => bulkDateInput.classList.toggle('hidden', !e.target.checked));
if (bulkUpdateMethodCheck) bulkUpdateMethodCheck.addEventListener('change', (e) => bulkMethodSelect.classList.toggle('hidden', !e.target.checked));
if (bulkPayInstallmentCheck) bulkPayInstallmentCheck.addEventListener('change', (e) => bulkInstallmentInputs.classList.toggle('hidden', !e.target.checked));
if (bulkUpdateConfirmationCheck) bulkUpdateConfirmationCheck.addEventListener('change', (e) => bulkConfirmationSelect.classList.toggle('hidden', !e.target.checked));

if (openBulkModalBtn) {
    openBulkModalBtn.addEventListener('click', () => {
        document.getElementById('bulk-count-msg').textContent = `Editando ${selectedParticipantIds.size} participantes`;
        bulkForm.reset();
        if (bulkStatusSelect) bulkStatusSelect.classList.add('hidden');
        if (bulkDateInput) bulkDateInput.classList.add('hidden');
        if (bulkMethodSelect) bulkMethodSelect.classList.add('hidden');
        if (bulkInstallmentInputs) bulkInstallmentInputs.classList.add('hidden');
        if (bulkConfirmationSelect) bulkConfirmationSelect.classList.add('hidden');
        bulkModalContainer.classList.remove('hidden');
    });
}

const bulkDeleteBtn = document.getElementById('bulk-delete-btn');
if (bulkDeleteBtn) {
    bulkDeleteBtn.addEventListener('click', () => {
        if (selectedParticipantIds.size === 0) return;

        if (confirm(`Tem certeza que deseja excluir ${selectedParticipantIds.size} participante(s) selecionado(s)?`)) {
            participants = participants.filter(p => !selectedParticipantIds.has(p.id));
            localStorage.setItem('event_master_participants', JSON.stringify(participants));

            selectedParticipantIds.clear();
            renderParticipantList(document.getElementById('search-participants').value);
            renderDashboard();
            updateUIContext();
            updateBulkActionsUI();
            lucide.createIcons();

            alert(`${selectedParticipantIds.size === 1 ? 'Participante excluído' : 'Participantes excluídos'} com sucesso!`);
        }
    });
}

if (closeBulkModalBtn) {
    closeBulkModalBtn.addEventListener('click', () => {
        bulkModalContainer.classList.add('hidden');
    });
}

if (bulkForm) {
    bulkForm.addEventListener('submit', (e) => {
        e.preventDefault();
        applyBulkEdit();
    });
}

function applyBulkEdit() {
    if (selectedParticipantIds.size === 0) return;

    const applyInstallments = bulkApplyInstallments ? bulkApplyInstallments.checked : false;
    const updateStatus = bulkUpdateStatusCheck ? bulkUpdateStatusCheck.checked : false;
    const newStatus = bulkStatusSelect ? bulkStatusSelect.value : 'pending';
    const updateDate = bulkUpdateDateCheck ? bulkUpdateDateCheck.checked : false;
    const newDate = bulkDateInput ? bulkDateInput.value : '';
    const updateMethod = bulkUpdateMethodCheck ? bulkUpdateMethodCheck.checked : false;
    const newMethod = bulkMethodSelect ? bulkMethodSelect.value : '';
    const paySpecificInstallment = bulkPayInstallmentCheck ? bulkPayInstallmentCheck.checked : false;
    const targetInstallmentNumber = parseInt(bulkInstallmentNumber ? bulkInstallmentNumber.value : 0);
    const targetInstallmentDate = bulkInstallmentDate ? bulkInstallmentDate.value : '';
    const updateConfirmation = bulkUpdateConfirmationCheck ? bulkUpdateConfirmationCheck.checked : false;
    const newConfirmation = bulkConfirmationSelect ? bulkConfirmationSelect.value : 'later';

    // Get Current Event Info if needing installments
    let eventDefaultPrice = 0;
    let eventMaxInst = 1;
    let eventDueDay = null;
    let eventSchedule = null;

    if (currentEventId) {
        const evt = events.find(e => e.id === currentEventId);
        if (evt) {
            eventDefaultPrice = evt.defaultPrice || 0;
            eventMaxInst = evt.maxInstallments || 1;
            eventDueDay = evt.dueDay;
            eventSchedule = evt.installmentSchedule;
        }
    }

    participants = participants.map(p => {
        if (!selectedParticipantIds.has(p.id)) return p;

        let updatedP = { ...p };

        // 1. Aplica Parcelamento Padrão
        if (applyInstallments && eventDefaultPrice > 0 && eventMaxInst > 1) {
            updatedP.price = eventDefaultPrice;
            updatedP.paymentType = 'installments';

            // Generate Installments
            const newInstallments = [];
            const valPerInst = (eventDefaultPrice / eventMaxInst);
            // Date Logic
            const today = new Date();
            let startYear = today.getFullYear();
            let startMonth = today.getMonth();
            if (eventDueDay && today.getDate() > eventDueDay) startMonth++;

            for (let i = 1; i <= eventMaxInst; i++) {
                let dDate = '';
                if (eventSchedule && eventSchedule[i]) {
                    dDate = eventSchedule[i];
                } else if (eventDueDay) {
                    const d = new Date(startYear, startMonth + (i - 1), eventDueDay);
                    dDate = d.toISOString().split('T')[0];
                }

                newInstallments.push({
                    number: i,
                    totalValue: parseFloat(valPerInst.toFixed(2)),
                    paidValue: 0,
                    dueDate: dDate,
                    paymentDate: '',
                    status: 'pending'
                });
            }
            const currentTotal = newInstallments.reduce((sum, item) => sum + item.totalValue, 0);
            const diff = eventDefaultPrice - currentTotal;
            if (diff !== 0) {
                newInstallments[newInstallments.length - 1].totalValue += diff;
            }

            updatedP.installments = newInstallments;
            updatedP.paidAmount = 0;
        }

        // 2. Outras Atualizações
        if (updateStatus) {
            updatedP.status = newStatus;

            if (newStatus === 'paid') {
                if (updatedP.paymentType === 'installments' && updatedP.installments) {
                    updatedP.installments = updatedP.installments.map(i => ({
                        ...i,
                        status: 'paid',
                        paidValue: i.totalValue,
                        paymentDate: newDate || new Date().toISOString().split('T')[0]
                    }));
                    updatedP.paidAmount = updatedP.price;
                } else {
                    updatedP.paidAmount = updatedP.price;
                }
            }
        }

        if (updateDate && newDate) {
            updatedP.paymentDate = newDate;
        }

        if (updateMethod) {
            updatedP.paymentMethod = newMethod;
        }

        if (updateConfirmation) {
            updatedP.confirmation = newConfirmation;
        }

        // 3. Baixar Parcela Específica
        if (paySpecificInstallment && targetInstallmentNumber > 0 && updatedP.paymentType === 'installments' && updatedP.installments) {
            updatedP.installments = updatedP.installments.map(inst => {
                if (inst.number === targetInstallmentNumber) {
                    return {
                        ...inst,
                        status: 'paid',
                        paidValue: inst.totalValue,
                        paymentDate: targetInstallmentDate || new Date().toISOString().split('T')[0]
                    };
                }
                return inst;
            });

            // Recalculate Paid Amount & Status
            const totalPaid = updatedP.installments.reduce((sum, inst) => sum + inst.paidValue, 0);
            updatedP.paidAmount = totalPaid;

            if (totalPaid >= updatedP.price) updatedP.status = 'paid';
            else if (totalPaid > 0) updatedP.status = 'pending';
        }

        return updatedP;
    });

    localStorage.setItem('event_master_participants', JSON.stringify(participants));
    if (bulkModalContainer) bulkModalContainer.classList.add('hidden');
    selectedParticipantIds.clear();
    renderParticipantList(document.getElementById('search-participants').value);
    renderDashboard();
    updateUIContext();
    alert("Alterações aplicadas com sucesso!");
}

function generatePrintableReport() {
    if (!currentEventId) {
        alert("Selecione um evento para gerar o relatório.");
        return;
    }

    const event = events.find(e => e.id === currentEventId);
    if (!event) return;

    const reportParticipants = participants.filter(p => p.eventId === currentEventId);

    // Calculate Totals
    const totalParticipants = reportParticipants.length;
    const totalProjected = reportParticipants.reduce((sum, p) => sum + p.price, 0);
    const totalPaid = reportParticipants.reduce((sum, p) => sum + (p.paidAmount || 0), 0);
    const totalPending = totalProjected - totalPaid;

    let html = `
        <html>
        <head>
            <title>Relatório - ${event.name}</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; color: #333; }
                h1, h2, h3 { margin: 0; }
                .header { margin-bottom: 2rem; border-bottom: 2px solid #333; padding-bottom: 1rem; }
                .meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-top: 1rem; }
                .meta-box { background: #f5f5f5; padding: 0.5rem; text-align: center; border-radius: 4px; }
                .meta-label { font-size: 0.8rem; color: #666; display: block; }
                .meta-value { font-size: 1.1rem; font-weight: bold; }
                
                table { width: 100%; border-collapse: collapse; margin-top: 1rem; font-size: 0.9rem; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; vertical-align: top; }
                th { background-color: #f8f9fa; font-weight: 600; }
                .status-paid { color: green; font-weight: bold; }
                .status-pending { color: orange; font-weight: bold; }
                
                .installments-row { margin-top: 0.3rem; font-size: 0.8rem; color: #555; line-height: 1.4; }
                .inst-sep { color: #ccc; margin: 0 4px; }
                .inst-paid { color: green; font-weight: 500; }
                
                @media print {
                    .no-print { display: none; }
                    body { padding: 0; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>${event.name}</h1>
                <p>Data: ${event.date || 'N/A'} - Local: ${event.location || 'N/A'}</p>
                <div class="meta-grid">
                    <div class="meta-box">
                        <span class="meta-label">Participantes</span>
                        <span class="meta-value">${totalParticipants}</span>
                    </div>
                    <div class="meta-box">
                        <span class="meta-label">Total Previsto</span>
                        <span class="meta-value">R$ ${totalProjected.toFixed(2).replace('.', ',')}</span>
                    </div>
                    <div class="meta-box">
                        <span class="meta-label">Total Recebido</span>
                        <span class="meta-value" style="color: green;">R$ ${totalPaid.toFixed(2).replace('.', ',')}</span>
                    </div>
                    <div class="meta-box">
                        <span class="meta-label">A Receber</span>
                        <span class="meta-value" style="color: orange;">R$ ${totalPending.toFixed(2).replace('.', ',')}</span>
                    </div>
                </div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th>Nome / Contato</th>
                        <th style="width: 100px;">Status</th>
                        <th>Pagamento</th>
                        <th style="width: 120px;">Financeiro</th>
                        <th>Detalhamento de Parcelas</th>
                    </tr>
                </thead>
                <tbody>
    `;

    reportParticipants.forEach(p => {
        const isPaid = p.status === 'paid';
        const statusLabel = isPaid ? 'PAGO' : 'PENDENTE';
        const statusClass = isPaid ? 'status-paid' : 'status-pending';
        const paymentInfo = p.paymentType === 'installments' ? 'Parcelado' : (p.paymentMethod || 'A vista');

        let installmentsHtml = '-';
        if (p.paymentType === 'installments' && p.installments && p.installments.length > 0) {
            installmentsHtml = '<div class="installments-row">';
            const instStrings = p.installments.map(inst => {
                const iPaid = inst.status === 'paid';
                const iClass = iPaid ? 'inst-paid' : '';
                const getDate = iPaid ? inst.paymentDate : inst.dueDate;
                const formattedDate = formatDate(getDate);
                const info = iPaid ? `Pg: ${formattedDate}` : `Venc: ${formattedDate}`;

                return `<span class="inst-item ${iClass}"><b>P${inst.number}</b>: R$${inst.totalValue.toFixed(2)} (${info})</span>`;
            });
            installmentsHtml += instStrings.join(' <span class="inst-sep">|</span> ');
            installmentsHtml += '</div>';
        }

        html += `
            <tr>
                <td>
                    <strong>${p.name}</strong><br/>
                    <small>${p.email || ''}</small><br/>
                    <small>${p.phone || ''}</small>
                </td>
                <td class="${statusClass}">${statusLabel}</td>
                <td>${paymentInfo}</td>
                <td>
                    Prev: R$ ${p.price.toFixed(2)}<br/>
                    Pago: R$ ${p.paidAmount.toFixed(2)}
                </td>
                <td>${installmentsHtml}</td>
            </tr>
        `;
    });

    html += `
                </tbody>
            </table>
            <div style="margin-top: 2rem; text-align: center; font-size: 0.8rem; color: #999;">
                Gerado pelo EventMaster em ${new Date().toLocaleString('pt-BR')}
            </div>
            <script>window.print();</script>
        </body>
        </html>
    `;

    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-'); // YYYY-MM-DD
    if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
    return dateStr;
}

// Global scope
window.generatePrintableReport = generatePrintableReport;
window.updateStatus = updateStatus;
window.deleteParticipant = deleteParticipant;
window.editParticipant = editParticipant;
window.switchEvent = switchEvent;
window.editEvent = editEvent;
window.deleteEvent = deleteEvent;
window.transferRemainder = transferRemainder;
window.togglePaidStatus = togglePaidStatus;
window.exportFinanceCSV = exportFinanceCSV;
window.exportParticipantsCSV = exportParticipantsCSV;
window.sendWhatsApp = sendWhatsApp;
window.sendInstallmentWhatsApp = sendInstallmentWhatsApp;
window.openExpenseModal = openExpenseModal; // Expor
window.saveExpense = saveExpense; // Expor

function importParticipantsCSV(file) {
    if (!currentEventId) {
        alert("Por favor, selecione um evento ou crie um novo antes de importar.");
        return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        const text = e.target.result;
        const lines = text.split('\n');
        let importedCount = 0;

        // Pular cabeçalho se existir? Vamos assumir que não tem ou que a primeira linha pode ser dados.
        // Melhor: verificar se a primeira linha tem 'Nome' ou 'Email'
        let startIndex = 0;
        if (lines[0].toLowerCase().includes('nome') || lines[0].toLowerCase().includes('email')) {
            startIndex = 1;
        }

        for (let i = startIndex; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            // Suporta separador , ou ;
            const parts = line.split(/[;,]/).map(part => part.trim());

            // Formato esperado: Nome, Email, Telefone
            // Formato esperado: Nome, Email, Telefone, Preço, Confirmação
            // Se tiver menos campos, tenta mapear o que tem
            if (parts.length >= 1) {
                const name = parts[0];
                const email = parts.length > 1 ? parts[1] : '';
                const phone = parts.length > 2 ? parts[2] : '';
                const price = parts.length > 3 && !isNaN(parseFloat(parts[3])) ? parseFloat(parts[3]) : 0;
                const confirmation = parts.length > 4 ? parts[4].toLowerCase() : 'later'; // Default 'later'

                if (name) {
                    participants.push({
                        id: Date.now() + importedCount, // Offset para garantir IDs unicos no loop rapido
                        eventId: currentEventId,
                        name: name,
                        email: email,
                        phone: phone,
                        confirmation: confirmation,
                        price: price,
                        paymentType: 'cash',
                        status: 'pending',
                        installments: [],
                        paidAmount: 0
                    });
                    importedCount++;
                }
            }
        }

        if (importedCount > 0) {
            localStorage.setItem('event_master_participants', JSON.stringify(participants));
            renderParticipantList();
            renderDashboard();
            updateUIContext();
            alert(`${importedCount} participantes importados com sucesso!`);
        } else {
            alert("Nenhum participante válido encontrado no arquivo.");
        }
    };
    reader.readAsText(file);
}

// init();
