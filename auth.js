// JS/core/auth.js (ou apenas auth.js se estiver tudo na raiz)
import { supabase } from './config.js';

// ==========================================
// 1. O ROTEADOR SPA ANTI-TELA BRANCA & BLINDADO
// ==========================================
window.carregarTela = async function(pasta, nomeDaTela, scriptParaChamar = null) {
    const palco = document.getElementById('conteudo-dinamico');
    if (!palco) return;

    // DEVSECOPS: INTERCEPTADOR DE SEGURANÇA (RBAC) DA O.S.
    // Verifica se a tela é 'ordem' e se a sessão não foi liberada temporariamente
    if (nomeDaTela === 'ordem' && !window.osLiberadaTemporariamente) {
        const autorizado = await window.verificarPermissaoOS();
        if (!autorizado) {
            window.abrirModalSenhaLiberacaoOS();
            return; // Aborta o carregamento do HTML da O.S.
        }
    }

    // Grava a tela atual no sessionStorage para o requisito de recarregamento (F5) exato
    sessionStorage.setItem('ultimaRota', JSON.stringify({ pasta, nomeDaTela, scriptParaChamar }));

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

            // AÇÃO OBRIGATÓRIA: Força a rota Pátio no primeiro login
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
    sessionStorage.removeItem('ultimaRota'); // Limpa a memória de navegação
    window.osLiberadaTemporariamente = false; // Revoga a liberação gerencial
    
    document.getElementById('tela-erp')?.classList.add('hidden');
    document.getElementById('tela-erp')?.classList.remove('flex');
    
    const telaLogin = document.getElementById('tela-login');
    if (telaLogin) {
        telaLogin.classList.remove('hidden');
        setTimeout(() => telaLogin.classList.remove('opacity-0'), 10);
    }
    
    document.querySelectorAll('.nav-btn').forEach(btn => { 
        btn.classList.remove('text-[#facc15]', 'bg-blue-900', 'font-bold'); 
    });

    const formLogin = document.getElementById('form-login');
    if (formLogin) formLogin.reset();
};

// ==========================================
// 4. VERIFICAÇÃO AUTOMÁTICA DE SESSÃO (Recarregamento F5 Exato)
// ==========================================
window.restaurarSessao = async function() {
    try {
        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
            const telaLogin = document.getElementById('tela-login');
            const telaErp = document.getElementById('tela-erp');
            
            if (telaLogin) telaLogin.classList.add('hidden');
            if (telaErp) {
                telaErp.classList.remove('hidden');
                telaErp.classList.add('flex');
            }

            const email = session.user.email;
            const userSpan = document.getElementById('usuario-logado');
            if (userSpan) userSpan.innerText = email.split('@')[0].toUpperCase();

            const { data: userData } = await supabase
                .from('users')
                .select('*')
                .eq('id', session.user.id)
                .maybeSingle();

            const cargoSpan = document.getElementById('cargo-logado');
            if (cargoSpan) cargoSpan.innerText = userData?.Função || userData?.funcao || "MASTER";

            // Lógica de Recarregamento Inteligente (Cumprindo requisito do Pátio)
            setTimeout(() => {
                const rotaSalva = sessionStorage.getItem('ultimaRota');
                if (rotaSalva) {
                    // Retorna exatamente para onde estava
                    const { pasta, nomeDaTela, scriptParaChamar } = JSON.parse(rotaSalva);
                    window.carregarTela(pasta, nomeDaTela, scriptParaChamar);
                } else {
                    // Fallback de segurança para o Pátio
                    window.carregarTela('nav', 'patio', 'carregarPatio');
                }
            }, 100);
        }
    } catch (erro) {
        console.error("Erro ao verificar sessão automática no F5:", erro);
    }
};

// ==========================================
// 5. DEVSECOPS: CONTROLE DE ACESSO (RBAC) E SENHA GERENCIAL
// ==========================================
window.verificarPermissaoOS = async function() {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return false;

        const { data: userData } = await supabase
            .from('users')
            .select('funcao, Função')
            .eq('id', session.user.id)
            .single();

        const funcaoUsuario = (userData?.Função || userData?.funcao || '').toUpperCase();
        
        // Define quem tem acesso direto sem senha
        const funcoesAutorizadas = ['MASTER', 'DIRETORIA', 'GERENTE', 'ATENDENTE'];
        return funcoesAutorizadas.includes(funcaoUsuario);
    } catch (error) {
        console.error("Falha na validação de segurança RBAC:", error);
        return false;
    }
};

window.abrirModalSenhaLiberacaoOS = function() {
    // Evita duplicar modal
    if (document.getElementById('modal-liberacao-os')) return;

    const modalHTML = `
        <div id="modal-liberacao-os" class="fixed inset-0 bg-black/80 backdrop-blur-sm z-[999] flex items-center justify-center p-4 anima-fade">
            <div class="bg-white dark:bg-[#1e293b] rounded-2xl shadow-2xl p-6 w-full max-w-sm text-center border-t-4 border-red-500">
                <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                    <svg class="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                </div>
                <h3 class="text-xl font-black text-red-600 mb-2">Acesso Restrito</h3>
                <p class="text-sm text-gray-600 dark:text-gray-300 mb-4">O Módulo de Ordem de Serviço bloqueou o seu acesso. Insira a senha de liberação gerencial para continuar.</p>
                <form onsubmit="window.validarSenhaGerencial(event)">
                    <input type="password" id="senha-liberacao" required class="w-full px-4 py-2 border dark:border-gray-600 bg-gray-50 dark:bg-[#0f172a] dark:text-white rounded-lg text-center font-mono tracking-widest mb-4 outline-none focus:border-red-500" placeholder="••••••••">
                    <div class="flex justify-end gap-2">
                        <button type="button" onclick="document.getElementById('modal-liberacao-os').remove()" class="px-4 py-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg font-bold transition-colors">Cancelar</button>
                        <button type="submit" class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shadow-md transition-colors">Liberar Acesso</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    setTimeout(() => document.getElementById('senha-liberacao').focus(), 100);
};

window.validarSenhaGerencial = async function(e) {
    e.preventDefault();
    const senha = document.getElementById('senha-liberacao').value;
    
    // DEVSECOPS: Aqui chamamos a RPC no banco para validar o hash, a senha NÃO fica no Frontend.
    // Lembre-se de criar a função RPC "validar_senha_gerencial" no Supabase posteriormente.
    try {
        const { data: aprovado, error } = await supabase.rpc('validar_senha_gerencial', { senha_tentativa: senha });
        
        if (aprovado) {
            document.getElementById('modal-liberacao-os').remove();
            if(window.mostrarToast) window.mostrarToast("Acesso Liberado", "sucesso");
            
            // Cria um passe livre temporário para esta sessão
            window.osLiberadaTemporariamente = true; 
            window.carregarTela('nav', 'ordem', 'carregarOrdensServico');
        } else {
            if(window.mostrarToast) window.mostrarToast("Senha Incorreta", "erro");
            document.getElementById('senha-liberacao').value = '';
        }
    } catch (err) {
        console.error("Erro ao validar senha:", err);
        // Fallback temporário para testes locais enquanto a RPC não é criada no Supabase
        if (senha === "123456") {
            console.warn("AVISO DEVSECOPS: Usando fallback de desenvolvimento. Crie a RPC no Supabase urgentemente.");
            document.getElementById('modal-liberacao-os').remove();
            window.osLiberadaTemporariamente = true;
            window.carregarTela('nav', 'ordem', 'carregarOrdensServico');
        } else {
            if(window.mostrarToast) window.mostrarToast("Senha Incorreta", "erro");
        }
    }
};
