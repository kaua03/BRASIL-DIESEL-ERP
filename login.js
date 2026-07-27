// login.js
import { supabase } from '../core/config.js';

// ==========================================
// 1. ELEMENTOS DA TELA
// ==========================================
const telaLogin = document.getElementById('tela-login');
const telaErp = document.getElementById('tela-erp');
const btnLogin = document.getElementById('btn-login');
const resultado = document.getElementById('resultado');
const formLogin = document.getElementById('form-login');
const btnSair = document.getElementById('btn-sair');

// ==========================================
// 2. LÓGICA DE ENTRADA (LOGIN)
// ==========================================
if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('email').value;
        const senha = document.getElementById('senha').value;

        btnLogin.innerText = "Verificando...";
        btnLogin.disabled = true;

        try {
            // 1. Tenta autenticar no Supabase
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email: email,
                password: senha
            });

            if (authError) throw authError;

            // 2. Puxa os dados extras do usuário (Cargo/Função)
            const { data: userData } = await supabase
                .from('users')
                .select('*')
                .eq('id', authData.user.id)
                .single();

            // 3. Troca as telas (Esconde Login, Mostra ERP)
            if (telaLogin) telaLogin.classList.add('hidden');
            if (telaErp) {
                telaErp.classList.remove('hidden');
                telaErp.classList.add('flex');
            }

            // 4. Preenche o crachá do cabeçalho
            const userSpan = document.getElementById('usuario-logado');
            const cargoSpan = document.getElementById('cargo-logado');

            if (userSpan) userSpan.innerText = email.split('@')[0].toUpperCase();
            if (cargoSpan) cargoSpan.innerText = userData?.Função || userData?.funcao || "MASTER";

            // 5. O GATILHO SPA DA NOVA ARQUITETURA
            // Avisa o Roteador para colar a tela do pátio E DEPOIS rodar a função
            if (typeof window.carregarTela === 'function') {
                window.carregarTela('nav', 'ordem', 'carregarOrdensDeServico');

                // Acende a luz amarela do botão Pátio no menu superior
                document.querySelector('[data-tela="ordem"]')?.classList.add('text-[#facc15]', 'border-[#facc15]', 'bg-blue-900');
            }

        } catch (erro) {
            console.error("Erro no login:", erro);
            if (resultado) {
                resultado.innerHTML = `<span class="text-red-500 font-bold">Acesso negado. Verifique e-mail e senha.</span>`;
            }
        } finally {
            // Devolve o botão ao normal, dando erro ou sucesso
            btnLogin.innerText = "Entrar";
            btnLogin.disabled = false;
        }
    });
}

// ==========================================
// 3. LÓGICA DE SAÍDA (LOGOUT)
// ==========================================
if (btnSair) {
    btnSair.addEventListener('click', async () => {
        try {
            // 1. Invalida a sessão no servidor
            await supabase.auth.signOut();

            // 2. Inverte as telas (Esconde ERP, Mostra Login)
            if (telaErp) {
                telaErp.classList.add('hidden');
                telaErp.classList.remove('flex');
            }
            if (telaLogin) telaLogin.classList.remove('hidden');

            // 3. Limpa os campos por segurança
            const inputSenha = document.getElementById('senha');
            if (inputSenha) inputSenha.value = '';
            if (resultado) resultado.innerHTML = '';

        } catch (erro) {
            console.error("Erro ao sair:", erro);
        }
    });
}