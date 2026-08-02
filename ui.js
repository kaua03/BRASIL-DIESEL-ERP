// JS/utils/ui.js

// =========================================================================
// 1. CAIXA DE FERRAMENTAS VISUAIS (TOAST E CONFIRM)
// =========================================================================

window.mostrarToast = function(mensagem, tipo = 'info') {
    const toast = document.getElementById('custom-toast');
    const toastMsg = document.getElementById('toast-msg');
    const toastIcon = document.getElementById('toast-icon');
    
    if (!toast) {
        console.warn("Elemento Toast não encontrado no HTML. Usando alert como fallback.");
        alert(mensagem);
        return;
    }

    // Reseta as classes padrão
    toast.className = 'fixed top-5 right-5 z-[200] transform transition-transform duration-300 flex items-center gap-3 px-5 py-4 rounded-xl shadow-2xl text-white font-bold max-w-sm';

    // Aplica as cores conforme o tipo
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
    toast.classList.remove('translate-x-[150%]'); // Desliza para dentro da tela

    // Desliza para fora após 4 segundos
    setTimeout(() => { 
        toast.classList.add('translate-x-[150%]'); 
    }, 4000);
};

window.abrirConfirmacao = function(titulo, mensagem, tipo = 'aviso') {
    return new Promise((resolve) => {
        const modal = document.getElementById('custom-confirm');
        const box = document.getElementById('confirm-box');
        const btnOk = document.getElementById('btn-confirm-ok');
        const iconBg = document.getElementById('confirm-icon-bg');
        
        if (!modal) {
             console.warn("Modal de confirmação não encontrado. Usando confirm nativo.");
             return resolve(confirm(`${titulo}\n\n${mensagem}`));
        }

        document.getElementById('confirm-title').innerText = titulo;
        document.getElementById('confirm-msg').innerText = mensagem;

        // Estilização dinâmica do modal
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

        // Exibe o modal com animação
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        setTimeout(() => { 
            modal.classList.remove('opacity-0'); 
            box.classList.remove('scale-95'); 
        }, 10);

        // Função interna para fechar e devolver a resposta
        const fechar = (resultado) => {
            modal.classList.add('opacity-0'); 
            box.classList.add('scale-95');
            setTimeout(() => {
                modal.classList.add('hidden'); 
                modal.classList.remove('flex');
                resolve(resultado);
            }, 300);
        };

        // Escuta os cliques dos botões
        document.getElementById('btn-confirm-cancel').onclick = () => fechar(false);
        document.getElementById('btn-confirm-ok').onclick = () => fechar(true);
    });
};

// =========================================================================
// 2. O CORAÇÃO DO SISTEMA: ROTEADOR DE TELAS
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

            // Feedback visual de carregamento rápido
            palco.innerHTML = '<div class="flex h-full items-center justify-center"><div class="animate-spin rounded-full h-10 w-10 border-b-4 border-[#1a428a]"></div></div>';

            try {
                // 1. Busca o HTML da tela
                const response = await fetch(`views/${pasta}/${tela}.html`);
                if (!response.ok) throw new Error(`Falha ao buscar a tela: ${tela}`);
                const html = await response.text();

                // 2. Injeta o HTML na tela
                palco.innerHTML = html;

                // 3. DISPARA O GATILHO (O CÃO DE GUARDA É ACIONADO AQUI!)
                // Se a função estiver pronta na memória (como window.carregarPainelMaster), ele dispara
                if (gatilho && typeof window[gatilho] === 'function') {
                    window[gatilho]();
                } 
                // TRAVA DE SEGURANÇA MÁXIMA PARA O PAINEL MASTER
                // Caso a memória atrase, forçamos o disparo sabendo a tela!
                else if (tela === 'master') {
                    if (typeof window.carregarPainelMaster === 'function') {
                        window.carregarPainelMaster();
                    } else {
                        console.error("ERRO CRÍTICO: A função 'window.carregarPainelMaster' não foi carregada no ficheiro master.js!");
                    }
                } 
                else if (gatilho) {
                    console.warn(`Atenção: A função de gatilho '${gatilho}' não existe no seu Javascript!`);
                }

            } catch (error) {
                console.error("Erro no Roteador:", error);
                palco.innerHTML = `<div class="flex items-center justify-center h-full text-red-500 font-bold p-8 text-center">Erro 404: Não foi possível carregar a tela 'views/${pasta}/${tela}.html'</div>`;
            }
        });
    });
};
