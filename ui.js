// JS/utils/ui.js

// =========================================================================
// 0. ESCUDO ANTI-FLICKER (Impede a tela de login de piscar no F5)
// =========================================================================
// Se detetar sessão ativa, injeta CSS de força bruta em 1 milissegundo 
// para forçar a tela de login a ficar invisível antes de o HTML renderizar.
if (sessionStorage.getItem('bdp_user')) {
    const style = document.createElement('style');
    style.innerHTML = `#tela-login { display: none !important; } #tela-erp { display: flex !important; }`;
    document.head.appendChild(style);
}

// =========================================================================
// 1. CAIXA DE FERRAMENTAS VISUAIS (TOAST E CONFIRM)
// =========================================================================
window.mostrarToast = function(mensagem, tipo = 'info') {
    const toast = document.getElementById('custom-toast');
    const toastMsg = document.getElementById('toast-msg');
    const toastIcon = document.getElementById('toast-icon');
    
    if (!toast) {
        alert(mensagem);
        return;
    }

    toast.className = 'fixed top-5 right-5 z-[200] transform transition-transform duration-300 flex items-center gap-3 px-5 py-4 rounded-xl shadow-2xl text-white font-bold max-w-sm';

    if (tipo === 'sucesso') { 
        toast.classList.add('bg-green-600'); 
        toastIcon.innerText = '✅'; 
    } else if (tipo === 'erro') { 
        toast.classList.add('bg-red-600'); 
        toastIcon.innerText = '❌'; 
    } else if (tipo === 'aviso') { 
        toast.classList.add('bg-orange-500'); 
        toastIcon.innerText = '⚠️'; 
    } else {
        toast.classList.add('bg-[#1a428a]'); 
        toastIcon.innerText = 'ℹ️'; 
    }

    toastMsg.innerText = mensagem;
    toast.classList.remove('translate-x-[150%]');

    setTimeout(() => { toast.classList.add('translate-x-[150%]'); }, 4000);
};

window.abrirConfirmacao = function(titulo, mensagem, tipo = 'aviso') {
    return new Promise((resolve) => {
        const modal = document.getElementById('custom-confirm');
        const box = document.getElementById('confirm-box');
        const btnOk = document.getElementById('btn-confirm-ok');
        const iconBg = document.getElementById('confirm-icon-bg');
        
        if (!modal) return resolve(confirm(`${titulo}\n\n${mensagem}`));

        document.getElementById('confirm-title').innerText = titulo;
        document.getElementById('confirm-msg').innerText = mensagem;

        if (tipo === 'perigo') {
            box.classList.add('border-red-500'); 
            box.classList.remove('border-[#1a428a]');
            iconBg.className = 'w-12 h-12 rounded-full flex items-center justify-center text-2xl bg-red-100 text-red-600';
            btnOk.className = 'px-5 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors shadow-md';
        } else {
            box.classList.remove('border-red-500'); 
            box.classList.add('border-[#1a428a]');
            iconBg.className = 'w-12 h-12 rounded-full flex items-center justify-center text-2xl bg-orange-100 text-orange-600';
            btnOk.className = 'px-5 py-2 bg-[#1a428a] text-white font-bold rounded-lg hover:bg-blue-900 transition-colors shadow-md';
        }

        modal.classList.remove('hidden');
        modal.classList.add('flex');
        setTimeout(() => { modal.classList.remove('opacity-0'); box.classList.remove('scale-95'); }, 10);

        const fechar = (resultado) => {
            modal.classList.add('opacity-0'); box.classList.add('scale-95');
            setTimeout(() => { modal.classList.add('hidden'); modal.classList.remove('flex'); resolve(resultado); }, 300);
        };

        document.getElementById('btn-confirm-cancel').onclick = () => fechar(false);
        document.getElementById('btn-confirm-ok').onclick = () => fechar(true);
    });
};

// =========================================================================
// 2. O CORAÇÃO DO SISTEMA: ROTEADOR INTELIGENTE
// =========================================================================
window.configurarBotoesMenu = function() {
    const botoes = document.querySelectorAll('.nav-btn');
    const palco = document.getElementById('conteudo-dinamico');

    if (!palco) return;

    botoes.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();

            const pasta = btn.getAttribute('data-pasta');
            const tela = btn.getAttribute('data-tela');
            const gatilho = btn.getAttribute('data-gatilho');

            // 1. MEMÓRIA FOTOGRÁFICA: Grava a tela atual para o caso de o utilizador dar F5
            localStorage.setItem('bdp_ultima_pasta', pasta);
            localStorage.setItem('bdp_ultima_tela', tela);

            // 2. RADAR DE PRESENÇA (Transmissor): Avisa o Supabase que você mudou de sala!
            if (window.canalTransmissaoGeral) {
                try {
                    const userStr = sessionStorage.getItem('bdp_user');
                    if (userStr) {
                        const userObj = JSON.parse(userStr);
                        userObj.tela = tela; // Atualiza a tela na memória
                        sessionStorage.setItem('bdp_user', JSON.stringify(userObj));
                        window.canalTransmissaoGeral.track(userObj); // Envia o novo sinal de radar
                    }
                } catch(err) { console.error("Falha ao atualizar o radar:", err); }
            }

            // Feedback visual de carregamento
            palco.innerHTML = '<div class="flex h-full items-center justify-center"><div class="animate-spin rounded-full h-10 w-10 border-b-4 border-[#1a428a]"></div></div>';

            try {
                let response = await fetch(`views/${pasta}/${tela}.html`);
                if (!response.ok) response = await fetch(`views/${tela}.html`);
                if (!response.ok) response = await fetch(`${tela}.html`);
                if (!response.ok) throw new Error(`HTML não encontrado para: ${tela}`);
                
                const html = await response.text();
                palco.innerHTML = html; 

                // Disparador de Gatilhos
                if (gatilho && typeof window[gatilho] === 'function') {
                    window[gatilho]();
                } else if (tela === 'master' && typeof window.carregarPainelMaster === 'function') {
                    window.carregarPainelMaster(); 
                } else if (tela === 'dashboard' && typeof window.carregarDashboard === 'function') {
                    window.carregarDashboard();
                }

            } catch (error) {
                console.error("Erro no Roteador:", error);
                palco.innerHTML = `<div class="flex items-center justify-center h-full text-red-500 font-bold p-8 text-center">Erro 404: Não foi possível carregar o ecrã '${tela}'.</div>`;
            }
        });
    });
};

// =========================================================================
// 3. RECUPERADOR DE ABAS (PÓS-F5)
// =========================================================================
window.recuperarUltimaAba = function() {
    const telaSalva = localStorage.getItem('bdp_ultima_tela');
    if (telaSalva) {
        const btn = document.querySelector(`.nav-btn[data-tela="${telaSalva}"]`);
        if (btn) {
            btn.click(); // Simula um clique fantasma na aba onde você estava!
            return true;
        }
    }
    return false;
};
