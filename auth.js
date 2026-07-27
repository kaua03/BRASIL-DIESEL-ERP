// JS/core/auth.js (ou apenas auth.js se estiver tudo na raiz)
import { supabase } from './config.js';

// ==========================================
// 1. O ROTEADOR SPA ANTI-TELA BRANCA
// ==========================================
window.carregarTela = async function(pasta, nomeDaTela, scriptParaChamar = null) {
    const palco = document.getElementById('conteudo-dinamico');
    if (!palco) return;

    // 1. INJETA O LOADER IMEDIATAMENTE (Acaba com a tela branca/flickering)
    palco.innerHTML = `
        <div class="flex flex-col items-center justify-center h-full w-full anima-fade">
            <div class="animate-spin rounded-full h-14 w-14 border-t-4 border-b-4 border-[#1a428a] mb-4"></div>
            <p class="text-[#1a428a] font-black tracking-widest uppercase text-sm animate-pulse">Carregando Módulo...</p>
        </div>
    `;

    // 2. ATUALIZA A LUZ DA SIDEBAR NA HORA
    document.querySelectorAll('.nav-btn').forEach(btn => { 
        btn.classList.remove('text-[#facc15]', 'border-[#facc15]', 'bg-blue-900', 'font-bold'); 
        if (btn.getAttribute('data-tela') === nomeDaTela) {
            btn.classList.add('text-[#facc15]', 'bg-blue-900', 'font-bold');
        }
    });

    try {
        // 3. BUSCA O HTML NO SERVIDOR (CORRIGIDO PARA A RAIZ!)
        const resposta = await fetch(`./${nomeDaTela}.html`);
        if (!resposta.ok) throw new Error(`HTML não encontrado: ${nomeDaTela}`);
        
        const html = await resposta.text();
        
        // Dá 200ms para o usuário ver que o sistema respondeu e está fluído, depois cola o HTML
        setTimeout(() => {
            palco.innerHTML = html;

            // 4. CHAMA O BANCO DE DADOS (ex: carregarPatio)
            if (scriptParaChamar && typeof window[scriptParaChamar] === 'function') {
                window[scriptParaChamar]();
            }
        }, 200);
        
    } catch (erro) {
        console.error("Erro no Roteador:", erro);
        palco.innerHTML = `
            <div class="flex items-center justify-center h-full">
                <div class="bg-red-50 p-6 rounded-xl border border-red-200 text-center shadow-sm">
                    <span class="text-5xl block mb-3">🚧</span>
                    <h3 class="text-red-800 font-black text-xl uppercase tracking-wider">Módulo em Construção</h3>
                    <p class="text-red-600 font-medium mt-1">A tela <b>${nomeDaTela}</b> ainda não foi criada ou o caminho está incorreto.</p>
                </div>
            </div>`;
    }
};

// ==========================================
// 2. SISTEMA DE NAVEGAÇÃO
// ==========================================
window.configurarBotoesMenu = function() {
    document.querySelectorAll('.nav-btn').forEach(botao => {
        botao.addEventListener('click', (evento) => {
            const btn = evento.currentTarget;
            const pasta = btn.getAttribute('data-pasta');
            const tela = btn.getAttribute('data-tela');
            const gatilho = btn.getAttribute('data-gatilho');
            
            if (tela) {
                window.carregarTela(pasta, tela, gatilho);
            }
        });
    });
};

// ==========================================
// 3. LÓGICA DE LOGIN COM ROTA FORÇADA
// ==========================================
window.tentarLogar = async function(e) {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const senha = document.getElementById('senha').value;
    const btnLogin = document.getElementById('btn-login');
    const resultado = document.getElementById('resultado');

    if (btnLogin) {
        btnLogin.innerText = "Autenticando..."; 
        btnLogin.disabled = true;
    }

    try {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (authError) throw authError;

        const { data: userData } = await supabase.from('users').select('*').eq('id', authData.user.id).maybeSingle();

        // Faz transição de tela
        document.getElementById('tela-login')?.classList.add('opacity-0');
        setTimeout(() => {
            document.getElementById('tela-login')?.classList.add('hidden');
            document.getElementById('tela-erp')?.classList.remove('hidden');
            document.getElementById('tela-erp')?.classList.add('flex');
            
            // PREENCHE CRACHÁ
            if(document.getElementById('usuario-logado')) document.getElementById('usuario-logado').innerText = email.split('@')[0].toUpperCase();
            if(document.getElementById('cargo-logado')) document.getElementById('cargo-logado').innerText = userData?.Função || userData?.funcao || "DIRETORIA";

            // AÇÃO OBRIGATÓRIA: Força a rota Pátio usando a função nativa (sem clicks fantasmas)
            window.carregarTela('nav', 'patio', 'carregarPatio');
        }, 300);

    } catch (erro) {
        if(resultado) resultado.innerHTML = `<span class="text-red-500 font-bold">Acesso negado. Verifique os dados.</span>`;
    } finally {
        if(btnLogin) { btnLogin.innerText = "Entrar"; btnLogin.disabled = false; }
    }
};

window.fazerLogout = async function() {
    await supabase.auth.signOut();
    document.getElementById('tela-erp')?.classList.add('hidden');
    document.getElementById('tela-erp')?.classList.remove('flex');
    
    const telaLogin = document.getElementById('tela-login');
    if (telaLogin) {
        telaLogin.classList.remove('hidden');
        setTimeout(() => telaLogin.classList.remove('opacity-0'), 10);
    }
    
    // Limpa luzes do menu
    document.querySelectorAll('.nav-btn').forEach(btn => { 
        btn.classList.remove('text-[#facc15]', 'bg-blue-900', 'font-bold'); 
    });

    const formLogin = document.getElementById('form-login');
    if (formLogin) formLogin.reset();
};
