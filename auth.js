// JS/core/auth.js
import { supabase } from './config.js';

// ==========================================
// 1. O ROTEADOR SPA ANTI-TELA BRANCA & BLINDADO
// ==========================================
window.carregarTela = async function(pasta, nomeDaTela, scriptParaChamar = null) {
    const palco = document.getElementById('conteudo-dinamico');
    if (!palco) return;

    // DEVSECOPS: INTERCEPTADOR DE SEGURANÇA (RBAC) DA O.S.
    if (nomeDaTela === 'ordem' && !window.osLiberadaTemporariamente) {
        const autorizado = await window.verificarPermissaoOS();
        if (!autorizado) {
            window.abrirModalSenhaLiberacaoOS();
            return; 
        }
    }

    // Grava a tela atual no sessionStorage para o F5
    sessionStorage.setItem('ultimaRota', JSON.stringify({ pasta, nomeDaTela, scriptParaChamar }));

    // INJETA O LOADER
    palco.innerHTML = `
        <div class="flex flex-col items-center justify-center h-full w-full anima-fade">
            <div class="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-[#1a428a] mb-4"></div>
            <p class="text-[#1a428a] font-black tracking-widest uppercase text-xs animate-pulse">A carregar...</p>
        </div>
    `;

    // ATUALIZA A LUZ DA SIDEBAR
    document.querySelectorAll('.nav-btn').forEach(btn => { 
        btn.classList.remove('text-[#facc15]', 'bg-blue-900', 'font-bold'); 
        if (btn.getAttribute('data-tela') === nomeDaTela || btn.getAttribute('data-') === nomeDaTela) {
            btn.classList.add('text-[#facc15]', 'bg-blue-900', 'font-bold');
        }
    });

    try {
        const resposta = await fetch(`./${nomeDaTela}.html`);
        if (!resposta.ok) throw new Error(`HTML não encontrado: ${nomeDaTela}`);
        
        const html = await resposta.text();
        
        setTimeout(() => {
            palco.innerHTML = html;

            if (scriptParaChamar && typeof window[scriptParaChamar] === 'function') {
                window[scriptParaChamar]();
            }
        }, 100);
        
    } catch (erro) {
        console.error("Erro no Roteador:", erro);
        palco.innerHTML = `
            <div class="flex items-center justify-center h-full fade-in">
                <div class="bg-red-50 p-6 rounded-xl border border-red-200 text-center shadow-sm">
                    <span class="text-5xl block mb-3">🚧</span>
                    <h3 class="text-red-800 font-black text-xl uppercase tracking-wider">Módulo em Construção</h3>
                    <p class="text-red-600 font-medium mt-1">A tela <b>${nomeDaTela}</b> ainda não foi criada ou o caminho está incorreto.</p>
                </div>
            </div>`;
    }
};

window.configurarBotoesMenu = function() {
    document.querySelectorAll('.nav-btn').forEach(botao => {
        botao.addEventListener('click', (evento) => {
            const btn = evento.currentTarget;
            const pasta = btn.getAttribute('data-pasta');
            const tela = btn.getAttribute('data-tela') || btn.getAttribute('data-');
            const gatilho = btn.getAttribute('data-gatilho');
            
            if (tela) {
                window.carregarTela(pasta, tela, gatilho);
            }
        });
    });
};

// ==========================================
// 3. A NOVA LÓGICA DE LOGIN (TABELA DE FUNCIONÁRIOS)
// ==========================================
window.tentarLogar = async function(e) {
    e.preventDefault();
    const username = document.getElementById('username').value.trim().toLowerCase();
    const senhaBruta = document.getElementById('senha').value.trim();
    const btnLogin = document.getElementById('btn-login');
    const resultado = document.getElementById('resultado');

    if (btnLogin) {
        btnLogin.innerText = "Autenticando..."; 
        btnLogin.disabled = true;
    }

    try {
        // Busca o funcionário pelo nome de usuário
        const { data: user, error } = await supabase
            .from('funcionarios')
            .select('*')
            .eq('nome_usuario', username)
            .eq('status', 'Ativo')
            .single();

        if (error || !user) throw new Error("Usuário não encontrado ou inativo.");

        // Verifica a senha (A que guardámos em Base64)
        if (user.senha !== btoa(senhaBruta)) {
            throw new Error("Senha incorreta.");
        }

        // Sucesso! Grava a sessão local no navegador
        sessionStorage.setItem('bdp_user', JSON.stringify(user));

        document.getElementById('tela-login')?.classList.add('opacity-0');
        
        setTimeout(() => {
            document.getElementById('tela-login')?.classList.add('hidden');
            document.getElementById('tela-erp')?.classList.remove('hidden');
            document.getElementById('tela-erp')?.classList.add('flex');
            
            // PREENCHE CRACHÁ NA TELA
            if(document.getElementById('usuario-logado')) document.getElementById('usuario-logado').innerText = user.nome_completo;
            if(document.getElementById('cargo-logado')) document.getElementById('cargo-logado').innerText = user.cargo.toUpperCase();

            // APLICA AS PERMISSÕES DE ACESSO
            window.aplicarPermissoes(user.cargo);

        }, 150);

    } catch (erro) {
        console.error("Erro no login:", erro);
        if(resultado) resultado.innerHTML = `<span class="text-red-500 font-bold">${erro.message}</span>`;
    } finally {
        if(btnLogin) { btnLogin.innerText = "Entrar no Sistema"; btnLogin.disabled = false; }
    }
};

window.fazerLogout = async function() {
    sessionStorage.removeItem('bdp_user');
    sessionStorage.removeItem('ultimaRota'); 
    window.osLiberadaTemporariamente = false; 
    
    document.getElementById('tela-erp')?.classList.add('hidden');
    document.getElementById('tela-erp')?.classList.remove('flex');
    
    const telaLogin = document.getElementById('tela-login');
    if (telaLogin) {
        telaLogin.classList.remove('hidden');
        setTimeout(() => telaLogin.classList.remove('opacity-0'), 10);
    }
    
    const formLogin = document.getElementById('form-login');
    if (formLogin) formLogin.reset();
    if (document.getElementById('resultado')) document.getElementById('resultado').innerHTML = '';
};

// ==========================================
// 4. VERIFICAÇÃO AUTOMÁTICA DE SESSÃO (F5)
// ==========================================
window.restaurarSessao = async function() {
    try {
        const userStr = sessionStorage.getItem('bdp_user');

        if (userStr) {
            const user = JSON.parse(userStr);

            const telaLogin = document.getElementById('tela-login');
            const telaErp = document.getElementById('tela-erp');
            
            if (telaLogin) telaLogin.classList.add('hidden');
            if (telaErp) {
                telaErp.classList.remove('hidden');
                telaErp.classList.add('flex');
            }

            const userSpan = document.getElementById('usuario-logado');
            if (userSpan) userSpan.innerText = user.nome_completo;

            const cargoSpan = document.getElementById('cargo-logado');
            if (cargoSpan) cargoSpan.innerText = user.cargo.toUpperCase();

            // Aplica as permissões e carrega a tela
            window.aplicarPermissoes(user.cargo);
        }
    } catch (erro) {
        console.error("Erro ao verificar sessão automática no F5:", erro);
    }
};

// ==========================================
// 5. O MOTOR DE PERMISSÕES E VISIBILIDADE (RBAC)
// ==========================================
window.aplicarPermissoes = function(cargo) {
    // 1. Esconder todos os botões por padrão para segurança máxima
    const todasTelas = ['patio', 'ordem', 'lab', 'itens', 'estoque', 'cliente', 'veiculo', 'funcionario', 'receber', 'pagar', 'dashboard', 'PainelMaster', 'configuracoes'];
    
    todasTelas.forEach(tela => {
        const btn = document.querySelector(`.nav-btn[data-tela="${tela}"]`) || document.querySelector(`.nav-btn[data-="${tela}"]`);
        if (btn) btn.style.display = 'none';
    });

    // 2. Restaurar interface padrão (Pode ter sido alterada pelo Modo Tela)
    document.getElementById('sidebar')?.classList.remove('hidden');
    document.getElementById('header-principal')?.classList.remove('hidden');
    document.body.style.overflow = ''; // Devolve o scroll

    let rotasPermitidas = [];

    // 3. O Mapa de Acessos
    switch(cargo) {
        case 'Dono':
        case 'Analista':
            rotasPermitidas = todasTelas; // Acesso a tudo
            break;
        case 'Mecânico RSP':
            rotasPermitidas = ['patio', 'ordem', 'lab', 'itens', 'cliente', 'veiculo'];
            break;
        case 'Mecânico':
            // Clientes e Veículos só via "Cadastro Rápido" (não precisam do menu)
            rotasPermitidas = ['patio', 'ordem', 'itens']; 
            break;
        case 'Laboratório':
            rotasPermitidas = ['patio', 'ordem', 'lab', 'itens'];
            break;
        case 'Tela':
            rotasPermitidas = ['patio'];
            // AÇÕES DO MODO TELA CHEIA VISUAL
            document.getElementById('sidebar')?.classList.add('hidden');
            document.getElementById('header-principal')?.classList.add('hidden');
            document.documentElement.classList.remove('dark'); // Força Claro
            localStorage.setItem('tema', 'light');
            document.body.style.overflow = 'hidden'; // Evita scroll do body na TV
            break;
        default:
            rotasPermitidas = ['patio']; // Segurança fallback
            break;
    }

    // 4. Mostrar apenas os botões permitidos
    rotasPermitidas.forEach(tela => {
        const btn = document.querySelector(`.nav-btn[data-tela="${tela}"]`) || document.querySelector(`.nav-btn[data-="${tela}"]`);
        if (btn) btn.style.display = 'flex'; // Exibe o botão usando flexbox (conforme o seu CSS)
    });

    // 5. Carregar a Tela (F5 ou Início)
    const rotaSalva = sessionStorage.getItem('ultimaRota');
    if (rotaSalva && cargo !== 'Tela') {
        const { pasta, nomeDaTela, scriptParaChamar } = JSON.parse(rotaSalva);
        
        // Verifica se ele não tentou aceder a algo proibido pelo link
        if (rotasPermitidas.includes(nomeDaTela)) {
            window.carregarTela(pasta, nomeDaTela, scriptParaChamar);
            return;
        }
    }
    
    // Fallback: Se não tem rota salva ou tentou algo proibido, vai para o Pátio
    window.carregarTela('nav', 'patio', 'carregarPatio');
};

// ==========================================
// 6. DEVSECOPS: CONTROLE DE ACESSO DA ORDEM DE SERVIÇO
// ==========================================
window.verificarPermissaoOS = async function() {
    try {
        const userStr = sessionStorage.getItem('bdp_user');
        if (!userStr) return false;

        const user = JSON.parse(userStr);
        const cargo = user.cargo;
        
        // Estes não precisam de senha para O.S.
        const cargosLivres = ['Dono', 'Analista', 'Mecânico RSP'];
        
        return cargosLivres.includes(cargo);
    } catch (error) {
        console.error("Falha na validação de segurança RBAC:", error);
        return false;
    }
};

window.abrirModalSenhaLiberacaoOS = function() {
    if (document.getElementById('modal-liberacao-os')) return;

    const modalHTML = `
        <div id="modal-liberacao-os" class="fixed inset-0 bg-black/80 backdrop-blur-sm z-[999] flex items-center justify-center p-4 fade-in">
            <div class="bg-white dark:bg-[#1e293b] rounded-2xl shadow-2xl p-6 w-full max-w-sm text-center border-t-4 border-red-500">
                <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                    <svg class="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                </div>
                <h3 class="text-xl font-black text-red-600 mb-2">Acesso Restrito à O.S.</h3>
                <p class="text-sm text-gray-600 dark:text-gray-300 mb-4">O seu cargo exige senha de autorização gerencial para aceder ao Orçamento e Faturamento.</p>
                <form onsubmit="window.validarSenhaGerencial(event)">
                    <input type="password" id="senha-liberacao" required class="w-full px-4 py-2 border dark:border-gray-600 bg-gray-50 dark:bg-[#0f172a] dark:text-white rounded-lg text-center font-mono tracking-widest mb-4 outline-none focus:border-red-500" placeholder="••••••••">
                    <div class="flex justify-end gap-2">
                        <button type="button" onclick="document.getElementById('modal-liberacao-os').remove()" class="px-4 py-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg font-bold transition-colors">Voltar ao Pátio</button>
                        <button type="submit" class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shadow-md transition-colors">Liberar Acesso</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    setTimeout(() => document.getElementById('senha-liberacao').focus(), 50);
};

window.validarSenhaGerencial = async function(e) {
    e.preventDefault();
    const senhaTentativa = document.getElementById('senha-liberacao').value;
    
    try {
        // Tática de Segurança: Verifica se existe algum "Dono" com esta senha
        const { data: donos, error } = await supabase
            .from('funcionarios')
            .select('id')
            .eq('cargo', 'Dono')
            .eq('senha', btoa(senhaTentativa));
            
        if (donos && donos.length > 0) {
            document.getElementById('modal-liberacao-os').remove();
            if(window.mostrarToast) window.mostrarToast("Acesso Gerencial Autorizado", "sucesso");
            
            window.osLiberadaTemporariamente = true; 
            window.carregarTela('nav', 'ordem', 'carregarOrdensServico');
        } else {
            if(window.mostrarToast) window.mostrarToast("Senha Incorreta", "erro");
            document.getElementById('senha-liberacao').value = '';
        }
    } catch (err) {
        console.error("Erro ao validar senha:", err);
        if(window.mostrarToast) window.mostrarToast("Erro de comunicação.", "erro");
    }
};
