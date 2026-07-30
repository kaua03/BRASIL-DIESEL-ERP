// JS/modules/ordem.js
import { supabase } from './config.js';

window.itensOrcamento = [];
window.osEmEdicaoId = null;
window.osEmEdicaoNumero = null;
window.formAlterado = false;
window.modoLeitura = false;
window.itemEmEdicaoId = null;
window.listaVeiculosBdd = []; 
window.listaClientesBdd = []; 

// =========================================================================
// 1. MÁSCARAS E FUNÇÕES GLOBAIS DE VISUALIZAÇÃO
// =========================================================================

window.atualizarTopHeaderVisualizacao = function(os) {
    const hCliente = document.getElementById('header-view-cliente');
    const hVeiculo = document.getElementById('header-view-veiculo');
    const hPlaca = document.getElementById('header-view-placa');
    if(hCliente) hCliente.innerText = String(os.cliente || 'CLIENTE NÃO INFORMADO').toUpperCase();
    if(hVeiculo) hVeiculo.innerText = String(os.modelo || 'VEÍCULO NÃO INFORMADO').toUpperCase();
    if(hPlaca) hPlaca.innerText = window.formatarPlaca(os.placa);
};

window.formatarPlaca = function(placa) {
    if (!placa) return '';
    let p = String(placa).toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (/^[A-Z]{3}[0-9]{4}$/.test(p)) return p.substring(0, 3) + '-' + p.substring(3, 7);
    return p;
};

// Máscara auxiliar apenas para o modal rápido
window.mascaraPlacaVeiculoFormat = function(input) {
    let p = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 7);
    if (p.length === 7 && /^[A-Z]{3}[0-9]{4}$/.test(p)) {
        input.value = p.substring(0, 3) + '-' + p.substring(3, 7);
    } else { input.value = p; }
};

window.mascaraPlaca = function(input, fromUserInput = true) {
    if(!input) return;
    let p = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 7);
    
    if (p.length === 7) {
        if (/^[A-Z]{3}[0-9]{4}$/.test(p)) {
            input.value = p.substring(0, 3) + '-' + p.substring(3, 7);
        } else {
            input.value = p; // Mercosul
        }
        
        // O GATILHO INTELIGENTE: Puxa o carro e o dono!
        if (fromUserInput) {
            window.buscarDadosVeiculoNaOs(p);
        }
    } else {
        input.value = p;
    }
    if (typeof window.atualizarTituloModalOs === 'function') window.atualizarTituloModalOs(window.osNumeroAtual, input.value);
};

window.buscarDadosVeiculoNaOs = function(placaLimpa) {
    if (!window.listaVeiculosBdd) return;
    
    // Procura o veículo na lista carregada do banco
    const veiculoEncontrado = window.listaVeiculosBdd.find(v => v.placa === placaLimpa);
    
    if (veiculoEncontrado) {
        const setVal = (id, val) => { const el = document.getElementById(id); if(el) { el.value = val; el.dispatchEvent(new Event('input')); } };
        
        // 1. Preenche o carro
        setVal('modelo', veiculoEncontrado.modelo || '');
        setVal('marca', veiculoEncontrado.marca || '');
        setVal('ano', veiculoEncontrado.ano || '');
        
        // 2. A MÁGICA: Preenche o cliente automaticamente
        if (veiculoEncontrado.clientes && veiculoEncontrado.clientes.nome_razao) {
            setVal('cliente', veiculoEncontrado.clientes.nome_razao);
            // Chama a função que já existe para preencher o endereço do cliente
            window.preencherDadosClienteSelecionado(veiculoEncontrado.clientes.nome_razao);
        }
        
        if (window.mostrarToast) window.mostrarToast("Veículo e Cliente vinculados!", "sucesso");
    }
};

window.validarPlacaBrasil = function(placa) {
    if (!placa || String(placa).length < 3) return false;
    return true; 
};

window.mascaraCpfCnpj = function(input) {
    if(!input) return;
    let v = input.value.replace(/\D/g, "");
    
    if (v.length <= 11) {
        if (v.length > 9) input.value = v.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, "$1.$2.$3-$4");
        else if (v.length > 6) input.value = v.replace(/(\d{3})(\d{3})(\d{1,3})/, "$1.$2.$3");
        else if (v.length > 3) input.value = v.replace(/(\d{3})(\d{1,3})/, "$1.$2");
        else input.value = v;
    } else {
        v = v.substring(0, 14);
        if (v.length > 12) input.value = v.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{1,2})/, "$1.$2.$3/$4-$5");
        else if (v.length > 8) input.value = v.replace(/(\d{2})(\d{3})(\d{3})(\d{1,4})/, "$1.$2.$3/$4");
        else if (v.length > 5) input.value = v.replace(/(\d{2})(\d{3})(\d{1,3})/, "$1.$2.$3");
        else if (v.length > 2) input.value = v.replace(/(\d{2})(\d{1,3})/, "$1.$2");
        else input.value = v;
    }
};

window.mascaraCep = function(input) {
    if(!input) return;
    let v = input.value.replace(/\D/g, "").substring(0, 8);
    v = v.replace(/^(\d{5})(\d)/, "$1-$2");
    input.value = v;
};

window.mascaraValorItem = function(input) {
    if(!input) return;
    let v = input.value.replace(/\D/g, '');
    if (v === "") { input.value = ""; return; }
    input.value = (parseInt(v, 10) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

window.consultarCep = async function(input, prefixo = '') {
    if(!input) return;
    let cep = input.value.replace(/\D/g, '');
    if (cep.length === 8) {
        try {
            let res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            if (res.ok) {
                let dados = await res.json();
                if (!dados.erro) {
                    const setVal = (id, val) => { const el = document.getElementById(prefixo + id); if(el) el.value = val; };
                    setVal('endereco', String(dados.logradouro || '').trim().toUpperCase());
                    setVal('bairro', String(dados.bairro || '').trim().toUpperCase());
                    setVal('cidade', `${String(dados.localidade || '').trim().toUpperCase()} / ${String(dados.uf || '').trim().toUpperCase()}`);
                    document.getElementById(prefixo + 'numero_end')?.focus();
                }
            }
        } catch (e) { console.error(e); }
    }
};

// =========================================================================
// 2. CONEXÃO COM BDD, DATALISTS E AUTOFILL
// =========================================================================
window.carregarDatalists = async function() {
    try {
        const { data: clientes } = await supabase.from('clientes').select('*').order('nome_razao');
        if (clientes) {
            window.listaClientesBdd = clientes;
            const dlClientes = document.getElementById('lista-clientes');
            const dlClientesRapido = document.getElementById('lista-clientes-rapido-vei'); // Para o modal
            
            const opcoesHTML = clientes.map(c => `<option value="${c.nome_razao}">${c.cpf_cnpj || ''}</option>`).join('');
            if (dlClientes) dlClientes.innerHTML = opcoesHTML;
            if (dlClientesRapido) dlClientesRapido.innerHTML = opcoesHTML;
        }

        // AGORA PUXAMOS O VEÍCULO E O CLIENTE DELE JUNTOS (Inner Join)
        const { data: veiculos } = await supabase.from('veiculos').select('*, clientes(nome_razao)').order('modelo');
        if (veiculos) {
            window.listaVeiculosBdd = veiculos;
            const modelosUnicos = [...new Set(veiculos.map(v => v.modelo))];
            const dlVeiculos = document.getElementById('lista-veiculos');
            if (dlVeiculos) dlVeiculos.innerHTML = modelosUnicos.map(m => `<option value="${m}">`).join('');
        }
    } catch (e) { console.error("Erro ao carregar listas suspensas:", e); }
};

window.preencherDadosClienteSelecionado = function(nomeDigitado) {
    if (!nomeDigitado) return;
    const nomeUpper = nomeDigitado.trim().toUpperCase();
    
    const clienteEncontrado = window.listaClientesBdd.find(c => String(c.nome_razao).toUpperCase() === nomeUpper);
    
    if (clienteEncontrado) {
        const setVal = (id, val) => { const el = document.getElementById(id); if(el) { el.value = val; el.dispatchEvent(new Event('input')); } };
        
        setVal('cpf_cnpj', clienteEncontrado.cpf_cnpj || '');
        setVal('celular', clienteEncontrado.telefone || '');
        setVal('cliente_email', clienteEncontrado.email || '');
        
        if(clienteEncontrado.cep) setVal('cep', clienteEncontrado.cep);
        if(clienteEncontrado.endereco) setVal('endereco', clienteEncontrado.endereco);
        if(clienteEncontrado.numero_end) setVal('numero_end', clienteEncontrado.numero_end);
        if(clienteEncontrado.complemento) setVal('complemento', clienteEncontrado.complemento);
        if(clienteEncontrado.bairro) setVal('bairro', clienteEncontrado.bairro);
        if(clienteEncontrado.cidade) setVal('cidade', clienteEncontrado.cidade);
        
        if (window.mostrarToast) window.mostrarToast("Dados do cliente carregados!", "sucesso");
    }
};

document.addEventListener('input', function(e) {
    if (e.target && e.target.id === 'modelo') {
        const mod = e.target.value.trim().toUpperCase();
        if (window.listaVeiculosBdd && mod.length > 2) {
            const achou = window.listaVeiculosBdd.find(v => v.modelo && String(v.modelo).toUpperCase() === mod);
            if (achou && achou.marca) {
                const elMarca = document.getElementById('marca');
                if(elMarca) elMarca.value = String(achou.marca).toUpperCase();
            }
        }
    }
    
    if (e.target && e.target.id === 'cliente') {
        const val = e.target.value.trim().toUpperCase();
        const achou = window.listaClientesBdd.find(c => String(c.nome_razao).toUpperCase() === val);
        if(achou) window.preencherDadosClienteSelecionado(val);
    }
});

// =========================================================================
// 2.1 MÓDULO DE CADASTRO RÁPIDO DE CLIENTE (DENTRO DA O.S)
// =========================================================================
window.trocarTipoRapidoUI = function() {
    const isPj = document.querySelector('input[name="cli-rapido-tipo"][value="Jurídica"]').checked;
    const lblNome = document.getElementById('lbl-cli-rapido-nome');
    const lblDoc = document.getElementById('lbl-cli-rapido-doc');
    const inNome = document.getElementById('cli-rapido-nome');
    const inDoc = document.getElementById('cli-rapido-doc');

    if (isPj) {
        lblNome.innerText = "Razão Social / Nome Fantasia";
        lblDoc.innerText = "CNPJ";
        inNome.placeholder = "EMPRESA LTDA";
        inDoc.placeholder = "00.000.000/0000-00";
    } else {
        lblNome.innerText = "Nome Completo";
        lblDoc.innerText = "CPF";
        inNome.placeholder = "NOME DO CLIENTE";
        inDoc.placeholder = "000.000.000-00";
    }
    inDoc.value = '';
};

window.mascaraCpfCnpjRapido = function(input) {
    let v = input.value.replace(/\D/g, ""); 
    const isPj = document.querySelector('input[name="cli-rapido-tipo"][value="Jurídica"]').checked;

    if (!isPj) { 
        v = v.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
        input.value = v.substring(0, 14);
    } else { 
        v = v.replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2");
        input.value = v.substring(0, 18);

        const limpo = input.value.replace(/\D/g, "");
        if (limpo.length === 14) {
            window.buscarCnpjRapido(limpo);
        }
    }
};

window.buscarCnpjRapido = async function(cnpjLimpo) {
    const loading = document.getElementById('loading-receita-rapido');
    if(loading) { loading.classList.remove('hidden'); loading.classList.add('flex'); }

    try {
        const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`);
        if (!response.ok) throw new Error("CNPJ não encontrado");
        const data = await response.json();
        
        document.getElementById('cli-rapido-nome').value = data.razao_social || data.nome_fantasia || '';
        document.getElementById('cli-rapido-email').value = data.email || '';
        if (data.ddd_telefone_1) {
            const telInput = document.getElementById('cli-rapido-tel');
            telInput.value = data.ddd_telefone_1;
            window.mascaraCelular(telInput);
        }

        if (data.cep) {
            const cepInput = document.getElementById('cli-rapido-cep');
            cepInput.value = String(data.cep).replace(/\D/g, '').replace(/^(\d{5})(\d{3})$/, "$1-$2");
            window.consultarCep(cepInput, 'cli-rapido-'); 
        }
        
        if(data.numero) document.getElementById('cli-rapido-numero_end').value = data.numero;
        if(data.complemento) document.getElementById('cli-rapido-complemento').value = data.complemento;

        if(window.mostrarToast) window.mostrarToast("Dados da Receita preenchidos!", "sucesso");
    } catch (error) {
        console.error(error);
    } finally {
        if(loading) { loading.classList.add('hidden'); loading.classList.remove('flex'); }
    }
};

window.abrirCadastroRapidoCliente = function() {
    const form = document.querySelector('#modal-cliente-rapido form');
    if(form) form.reset();
    document.querySelector('input[name="cli-rapido-tipo"][value="Física"]').checked = true;
    window.trocarTipoRapidoUI();

    document.getElementById('modal-cliente-rapido').classList.remove('hidden');
    document.getElementById('modal-cliente-rapido').classList.add('flex');
};

window.salvarClienteRapido = async function(e) {
    e.preventDefault();
    
    const isPj = document.querySelector('input[name="cli-rapido-tipo"][value="Jurídica"]').checked;
    const getVal = (id) => document.getElementById(id)?.value || '';
    
    const docFormatado = getVal('cli-rapido-doc').trim();

    if (docFormatado) {
        const { data: duplicados } = await supabase.from('clientes').select('id').eq('cpf_cnpj', docFormatado);
        if (duplicados && duplicados.length > 0) {
            if (window.mostrarToast) window.mostrarToast("Erro: Este CPF/CNPJ já existe na base!", "erro");
            document.getElementById('cli-rapido-doc').focus();
            return; 
        }
    }

    const payload = {
        tipo_cliente: isPj ? 'Jurídica' : 'Física',
        nome_razao: getVal('cli-rapido-nome').trim().toUpperCase(),
        cpf_cnpj: docFormatado,
        telefone: getVal('cli-rapido-tel').trim(),
        email: getVal('cli-rapido-email').trim().toLowerCase(),
        cep: getVal('cli-rapido-cep').trim(),
        endereco: getVal('cli-rapido-endereco').trim().toUpperCase(),
        numero_end: getVal('cli-rapido-numero_end').trim(),
        bairro: getVal('cli-rapido-bairro').trim().toUpperCase(),
        cidade: getVal('cli-rapido-cidade').trim().toUpperCase(),
        complemento: getVal('cli-rapido-complemento').trim().toUpperCase(),
    };
    
    if(window.mostrarToast) window.mostrarToast("Salvando cliente no cofre...", "info");

    try {
        const { data, error } = await supabase.from('clientes').insert([payload]).select().single();

        if (error) throw error;

        if(window.mostrarToast) window.mostrarToast("Cliente salvo e vinculado!", "sucesso");
        
        await window.carregarDatalists();
        
        const setVal = (id, val) => { const el = document.getElementById(id); if(el) { el.value = val; el.dispatchEvent(new Event('input')); } };
        setVal('cliente', payload.nome_razao);
        setVal('cpf_cnpj', payload.cpf_cnpj);
        setVal('celular', payload.telefone);
        setVal('cliente_email', payload.email);
        setVal('cep', payload.cep);
        setVal('endereco', payload.endereco);
        setVal('numero_end', payload.numero_end);
        setVal('bairro', payload.bairro);
        setVal('cidade', payload.cidade);
        setVal('complemento', payload.complemento);

        document.getElementById('modal-cliente-rapido').classList.add('hidden');
        document.getElementById('modal-cliente-rapido').classList.remove('flex');
    } catch (err) {
        console.error(err);
        if(window.mostrarToast) window.mostrarToast("Erro ao cadastrar cliente.", "erro");
    }
};

// =========================================================================
// 2.2 MÓDULO DE CADASTRO RÁPIDO DE VEÍCULO (DENTRO DA O.S)
// =========================================================================
window.abrirCadastroRapidoVeiculo = function() {
    const form = document.querySelector('#modal-veiculo-rapido form');
    if(form) form.reset();
    
    // Puxar a placa que o usuário já estava a tentar digitar
    const placaDigitada = document.getElementById('placa').value;
    if(placaDigitada) {
        document.getElementById('vei-rapido-placa').value = placaDigitada;
    }

    // Se ele já tiver escolhido um cliente na O.S, sugere o vínculo
    const clienteOS = document.getElementById('cliente').value;
    if(clienteOS) {
        document.getElementById('vei-rapido-cliente').value = clienteOS;
    }

    document.getElementById('modal-veiculo-rapido').classList.remove('hidden');
    document.getElementById('modal-veiculo-rapido').classList.add('flex');
};

window.salvarVeiculoRapido = async function(e) {
    e.preventDefault();
    const getVal = (id) => document.getElementById(id)?.value || '';
    
    const placaLimpa = getVal('vei-rapido-placa').replace(/[^A-Za-z0-9-]/g, '').toUpperCase();
    if (placaLimpa.length < 7) {
        if(window.mostrarToast) window.mostrarToast("Placa inválida!", "erro");
        document.getElementById('vei-rapido-placa').focus(); return;
    }

    // Verificar se a placa já existe
    const { data: duplicados } = await supabase.from('veiculos').select('id').eq('placa', placaLimpa);
    if (duplicados && duplicados.length > 0) {
        if (window.mostrarToast) window.mostrarToast("Erro: Placa já cadastrada no sistema!", "erro");
        document.getElementById('vei-rapido-placa').focus(); return; 
    }

    const clienteDigitado = getVal('vei-rapido-cliente').trim().toUpperCase();
    let clienteIdEncontrado = null;
    if (clienteDigitado && window.listaClientesBdd) {
        const achou = window.listaClientesBdd.find(c => c.nome_razao === clienteDigitado);
        if (achou) clienteIdEncontrado = achou.id;
    }

    const payload = {
        placa: placaLimpa,
        uf: getVal('vei-rapido-uf').trim().toUpperCase(),
        marca: getVal('vei-rapido-marca').trim().toUpperCase(),
        modelo: getVal('vei-rapido-modelo').trim().toUpperCase(),
        ano: getVal('vei-rapido-ano').trim(),
        cliente_id: clienteIdEncontrado
    };

    if(window.mostrarToast) window.mostrarToast("Salvando veículo na garagem...", "info");

    try {
        const { error } = await supabase.from('veiculos').insert([payload]);
        if (error) throw error;

        if(window.mostrarToast) window.mostrarToast("Veículo cadastrado!", "sucesso");
        
        await window.carregarDatalists();
        
        // Auto-preencher na O.S
        const setVal = (id, val) => { const el = document.getElementById(id); if(el) { el.value = val; el.dispatchEvent(new Event('input')); } };
        setVal('placa', payload.placa);
        window.mascaraPlaca(document.getElementById('placa'), false); // formata o visual
        setVal('marca', payload.marca);
        setVal('modelo', payload.modelo);
        setVal('ano', payload.ano);
        
        document.getElementById('modal-veiculo-rapido').classList.add('hidden');
        document.getElementById('modal-veiculo-rapido').classList.remove('flex');
    } catch (err) {
        console.error(err);
        if(window.mostrarToast) window.mostrarToast("Erro ao cadastrar veículo.", "erro");
    }
};


// =========================================================================
// 3. MODO LEITURA E CORES DE STATUS
// =========================================================================
window.alternarModoLeitura = function(ativo) {
    window.modoLeitura = ativo;
    const form = document.getElementById('form-nova-os');
    if (!form) return;

    form.querySelectorAll('input, select, textarea').forEach(el => {
        if (el.type !== 'hidden') el.disabled = ativo;
    });

    const btnFecharOs = document.getElementById('btn-fechar-os');
    const btnBalcao = document.getElementById('btn-os-balcao'); 
    const painelAdicionar = document.getElementById('painel-adicionar-item');
    const painelEdicao = document.getElementById('painel-botoes-edicao');
    const cabecalho = document.getElementById('cabecalho-modal-os');
    const painelTopoResumo = document.getElementById('painel-topo-resumo');
    const btnAddCliente = document.getElementById('btn-add-cliente'); 

    if (ativo) {
        if (btnFecharOs) btnFecharOs.classList.add('hidden');
        if (btnBalcao) btnBalcao.classList.add('hidden'); 
        if (painelAdicionar) painelAdicionar.classList.add('hidden');
        if (painelEdicao) painelEdicao.classList.add('hidden');
        if (btnAddCliente) btnAddCliente.classList.add('hidden');
        if (painelTopoResumo) painelTopoResumo.classList.remove('hidden');
        if (cabecalho) { cabecalho.classList.remove('bg-[#1a428a]'); cabecalho.classList.add('bg-gray-700'); }
    } else {
        if (btnFecharOs) btnFecharOs.classList.remove('hidden');
        if (btnBalcao) btnBalcao.classList.remove('hidden'); 
        if (painelAdicionar) painelAdicionar.classList.remove('hidden');
        if (painelEdicao) painelEdicao.classList.remove('hidden');
        if (btnAddCliente) btnAddCliente.classList.remove('hidden');
        if (painelTopoResumo) painelTopoResumo.classList.add('hidden');
        if (cabecalho) { cabecalho.classList.add('bg-[#1a428a]'); cabecalho.classList.remove('bg-gray-700'); }
    }

    window.renderizarTabelaOrcamento();
    window.atualizarVisibilidadeBotoesFechamento();
};

window.obterCoresStatus = function(situacao) {
    switch(situacao) {
        case 'Aberto': return 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400 border-sky-200';
        case 'Orçamento': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200';
        case 'Aguardando Autorização': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200';
        case 'Aguardando Peça': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200';
        case 'Aguardando Pagamento': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200';
        case 'Autorizado': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200';
        case 'Em Execução': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400 border-indigo-200';
        case 'Garantia': return 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400 border-teal-200';
        case 'Não Usar': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200';
        case 'Recusado': return 'bg-red-200 text-red-900 dark:bg-red-900/50 dark:text-red-300 border-red-300';
        case 'Fechado': return 'bg-gray-200 text-gray-800 dark:bg-gray-800 dark:text-gray-300 border-gray-300';
        default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 border-gray-200';
    }
};

window.atualizarCorSelectSituacao = function(selectEl) {
    if (!selectEl) return;
    const val = selectEl.value;
    if (val === 'Aberto') { selectEl.style.backgroundColor = '#E0F2FE'; selectEl.style.color = '#0369A1'; }
    else if (val === 'Orçamento') { selectEl.style.backgroundColor = '#F3E8FF'; selectEl.style.color = '#6B21A8'; }
    else if (val === 'Aguardando Autorização') { selectEl.style.backgroundColor = '#FFEDD5'; selectEl.style.color = '#C2410C'; }
    else if (val === 'Aguardando Peça') { selectEl.style.backgroundColor = '#FEF3C7'; selectEl.style.color = '#B45309'; }
    else if (val === 'Autorizado') { selectEl.style.backgroundColor = '#DCFCE7'; selectEl.style.color = '#15803D'; }
    else if (val === 'Em Execução') { selectEl.style.backgroundColor = '#E0E7FF'; selectEl.style.color = '#3730A3'; }
    else if (val === 'Garantia') { selectEl.style.backgroundColor = '#CCFBF1'; selectEl.style.color = '#0F766E'; }
    else if (val === 'Aguardando Pagamento') { selectEl.style.backgroundColor = '#FEF08A'; selectEl.style.color = '#854D0E'; }
    else if (val === 'Não Usar') { selectEl.style.backgroundColor = '#FEE2E2'; selectEl.style.color = '#991B1B'; }
    else if (val === 'Recusado') { selectEl.style.backgroundColor = '#FECACA'; selectEl.style.color = '#B91C1C'; }
    else if (val === 'Fechado') { selectEl.style.backgroundColor = '#E5E7EB'; selectEl.style.color = '#1F2937'; }
};

window.atualizarTituloModalOs = function(numeroOs = null, placa = '') {
    const tituloEl = document.getElementById('modal-titulo-os');
    if (!tituloEl) return;
    const placaFormatada = window.formatarPlaca(placa || document.getElementById('placa')?.value);
    const sufixoLeitura = window.modoLeitura ? ' — [SOMENTE LEITURA]' : '';

    if (window.osEmEdicaoId && numeroOs) {
        const numFormatado = String(numeroOs).padStart(4, '0');
        tituloEl.innerText = `Ordem de Serviço Nº ${numFormatado} — Placa: ${placaFormatada || '---'}${sufixoLeitura}`;
    } else {
        tituloEl.innerText = `Nova Ordem de Serviço`;
    }
};

window.toggleDrop = function(event, id, btnElement) {
    if(event) { event.preventDefault(); event.stopPropagation(); }

    const menuId = `menu-${id}`;
    const menu = document.getElementById(menuId);
    if (!menu) return;

    const estavaEscondido = menu.classList.contains('hidden');

    document.querySelectorAll('.menu-acao-os').forEach(el => {
        el.classList.add('hidden');
    });

    if (estavaEscondido) {
        menu.classList.remove('hidden');
        
        const rect = btnElement.getBoundingClientRect();
        menu.style.position = 'fixed'; 
        menu.style.zIndex = '99999';
        
        const menuWidth = 192; 
        const menuHeight = menu.offsetHeight || 160;

        let topPos = rect.bottom + 4;
        if (topPos + menuHeight > window.innerHeight && rect.top > menuHeight) {
            topPos = rect.top - menuHeight - 4;
        }

        let leftPos = rect.right - menuWidth; 
        if (leftPos < 0) leftPos = rect.left; 
        
        menu.style.top = `${topPos}px`;
        menu.style.left = `${leftPos}px`;
    }
};

document.addEventListener('click', function(event) {
    if (!event.target.closest('.dropdown-container')) {
        document.querySelectorAll('.menu-acao-os').forEach(el => el.classList.add('hidden'));
    }
});

window.alterarStatusOsInline = async function(id, selectElement) {
    const novaSituacao = selectElement.value;
    selectElement.className = `text-[10px] uppercase px-2 py-1.5 rounded-lg font-black tracking-wider outline-none cursor-pointer text-center text-center-last border shadow-sm transition-all w-full max-w-[140px] ${window.obterCoresStatus(novaSituacao)}`;

    try {
        const { error } = await supabase.from('ordens_servico').update({ situacao: novaSituacao, status: novaSituacao }).eq('id', id);
        if (error) throw error;
        if (window.mostrarToast) window.mostrarToast("Situação atualizada!", "sucesso");
        window.carregarOrdensServico(); 
    } catch (e) {
        console.error("ERRO AO ATUALIZAR STATUS:", e);
        if (window.mostrarToast) window.mostrarToast("Erro ao atualizar situação.", "erro");
        window.carregarOrdensServico(); 
    }
};

// =========================================================================
// 4. FÁBRICA DE PDF E WHATSAPP
// =========================================================================
window.gerarHtmlDocumentoOs = function(os, itens) {
    let tPecas = 0; let tServ = 0;
    let htmlPecas = ''; let htmlServicos = '';

    (itens || []).forEach((i, idx) => {
        if (i.tipo === 'Peça') tPecas += i.subtotal;
        if (i.tipo === 'Serviço') tServ += i.subtotal;

        if (i.tipo === 'Peça') {
            htmlPecas += `
                <tr style="border-bottom: 1px solid #ccc; font-size: 10px;">
                    <td style="padding: 4px; border-right: 1px solid #ccc;">${String(idx + 1).padStart(4, '0')}</td>
                    <td style="padding: 4px; border-right: 1px solid #ccc;">${String(i.descricao || '').toUpperCase()}</td>
                    <td style="padding: 4px; border-right: 1px solid #ccc; text-align: center;">PC</td>
                    <td style="padding: 4px; border-right: 1px solid #ccc; text-align: center;">${(i.quantidade || 1).toLocaleString('pt-BR', {minimumFractionDigits: 4})}</td>
                    <td style="padding: 4px; border-right: 1px solid #ccc; text-align: right;">R$ ${(i.valor_unitario || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                    <td style="padding: 4px; text-align: right;">R$ ${(i.subtotal || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                </tr>
            `;
        } else {
            htmlServicos += `
                <tr style="border-bottom: 1px solid #ccc; font-size: 10px;">
                    <td style="padding: 4px; border-right: 1px solid #ccc;">${String(idx + 1).padStart(4, '0')} - ${String(i.descricao || '').toUpperCase()}</td>
                    <td style="padding: 4px; border-right: 1px solid #ccc; text-align: center;"></td>
                    <td style="padding: 4px; border-right: 1px solid #ccc; text-align: center;"></td>
                    <td style="padding: 4px; border-right: 1px solid #ccc; text-align: center;"></td>
                    <td style="padding: 4px; border-right: 1px solid #ccc; text-align: center;">${(i.quantidade || 1).toLocaleString('pt-BR', {minimumFractionDigits: 4})}</td>
                    <td style="padding: 4px; border-right: 1px solid #ccc; text-align: right;">R$ ${(i.valor_unitario || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                    <td style="padding: 4px; text-align: right;">R$ ${(i.subtotal || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                </tr>
            `;
        }
    });

    const osNum = String(os.numero_os || os.id || '0000').padStart(4, '0');
    const emissao = new Date().toLocaleString('pt-BR');
    const dataDoc = os.data_hora ? new Date(os.data_hora).toLocaleDateString('pt-BR') : '---';
    const placaDoc = window.formatarPlaca(os.placa);

    return `
        <div style="font-family: Arial, sans-serif; color: #000; padding: 20px; font-size: 11px; background: white; width: 100%; max-width: 800px; margin: 0 auto; box-sizing: border-box;">
            <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 10px;">
                <div style="display: flex; align-items: center; gap: 15px;">
                    <img src="../../LOGO BDP_2.jpeg" alt="Logo" style="width: 130px; height: auto;" onerror="this.style.display='none'">
                    <div style="line-height: 1.3;">
                        <h1 style="margin: 0 0 5px 0; font-size: 18px; font-weight: 900; color: #1a428a;">BRASIL DIESEL PERFORMANCE</h1>
                        <p style="margin: 0; font-size: 10px; font-weight: bold;">FONE: (34) 999700792</p>
                        <p style="margin: 0; font-size: 10px;">AVENIDA ORTÍZIO BORGES, 2488 - SANTA MÔNICA</p>
                        <p style="margin: 0; font-size: 10px;">CEP: 38408263 - UBERLÂNDIA - MG</p>
                        <p style="margin: 0; font-size: 10px;">ATENDIMENTO@BRASILDIESELPERFORMANCE.COM.BR</p>
                    </div>
                </div>
                <div style="border: 1px solid #000; padding: 10px; width: 220px; font-size: 10px;">
                    <h2 style="margin: 0 0 10px 0; font-size: 14px; text-align: center; text-transform: uppercase;">OS ABERTURA</h2>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><strong>DATA DOC:</strong> <span>${dataDoc}</span></div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><strong>NÚM. DOC:</strong> <span>${osNum}</span></div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><strong>EMISSÃO:</strong> <span>${emissao}</span></div>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 2fr 1fr; border: 1px solid #000; padding: 8px; margin-bottom: 10px; font-size: 10px; line-height: 1.4;">
                <div>
                    <p style="margin: 2px 0;"><strong>Cliente:</strong> ${String(os.cliente || '---').toUpperCase()}</p>
                    <p style="margin: 2px 0;"><strong>Endereço:</strong> ${String(os.endereco || '---')}</p>
                    <p style="margin: 2px 0;"><strong>Bairro:</strong> ${String(os.bairro || '---')}</p>
                    <p style="margin: 2px 0;"><strong>Cnpj/Cpf:</strong> ${String(os.cpf_cnpj || '---')}</p>
                </div>
                <div>
                    <p style="margin: 2px 0;"><strong>Telefone:</strong> ${String(os.celular || '---')}</p>
                    <p style="margin: 2px 0;"><strong>Cep:</strong> ${String(os.cep || '---')}</p>
                    <p style="margin: 2px 0;"><strong>Cidade:</strong> ${String(os.cidade || '---')}</p>
                    <p style="margin: 2px 0;"><strong>Inscrição Est.:</strong> ${String(os.inscricao_estadual || '---')}</p>
                </div>
            </div>

            <div style="border: 1px solid #000; padding: 8px; margin-bottom: 10px; font-size: 10px; line-height: 1.4;">
                <div style="display: flex; gap: 20px;">
                    <p style="margin: 2px 0; flex: 2;"><strong>Veículo:</strong> ${String(os.modelo || '---').toUpperCase()}</p>
                    <p style="margin: 2px 0; flex: 1;"><strong>Marca:</strong> ${String(os.marca || '---').toUpperCase()}</p>
                    <p style="margin: 2px 0; flex: 1;"><strong>Ano/Modelo:</strong> ${String(os.ano || '---')}</p>
                    <p style="margin: 2px 0; flex: 1;"><strong>KM:</strong> ${String(os.km_veiculo || '---')}</p>
                </div>
            </div>

            <div style="border: 1px solid #000; padding: 8px; margin-bottom: 10px; font-size: 10px;">
                <strong>RELATO / DEFEITO:</strong><br>
                ${String(os.defeito || 'Nenhum relato registrado.').toUpperCase()}
            </div>

            <div style="page-break-inside: avoid;">
                <table style="width: 100%; border-collapse: collapse; border: 1px solid #000; margin-bottom: 15px;">
                    <thead>
                        <tr style="background-color: #f0f0f0; border-bottom: 1px solid #000; font-size: 10px;">
                            <th style="padding: 4px; text-align: left; border-right: 1px solid #ccc; width: 8%;">Código</th>
                            <th style="padding: 4px; text-align: left; border-right: 1px solid #ccc;">Descrição das Peças/Produtos/Marcas</th>
                            <th style="padding: 4px; text-align: center; border-right: 1px solid #ccc; width: 5%;">Vol</th>
                            <th style="padding: 4px; text-align: center; border-right: 1px solid #ccc; width: 10%;">Quant</th>
                            <th style="padding: 4px; text-align: right; border-right: 1px solid #ccc; width: 15%;">Valor Unit</th>
                            <th style="padding: 4px; text-align: right; width: 15%;">Valor Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${htmlPecas || '<tr><td colspan="6" style="padding:10px; text-align:center; font-style:italic;">Nenhuma peça lançada.</td></tr>'}
                    </tbody>
                </table>
            </div>

            <div style="page-break-inside: avoid;">
                <table style="width: 100%; border-collapse: collapse; border: 1px solid #000; margin-bottom: 15px;">
                    <thead>
                        <tr style="background-color: #f0f0f0; border-bottom: 1px solid #000; font-size: 10px;">
                            <th style="padding: 4px; text-align: left; border-right: 1px solid #ccc;">Descrição dos Serviços</th>
                            <th style="padding: 4px; text-align: center; border-right: 1px solid #ccc; width: 5%;">Tec1</th>
                            <th style="padding: 4px; text-align: center; border-right: 1px solid #ccc; width: 5%;">Tec2</th>
                            <th style="padding: 4px; text-align: center; border-right: 1px solid #ccc; width: 5%;">Tec3</th>
                            <th style="padding: 4px; text-align: center; border-right: 1px solid #ccc; width: 10%;">Quantidade</th>
                            <th style="padding: 4px; text-align: right; border-right: 1px solid #ccc; width: 15%;">Valor Unitário</th>
                            <th style="padding: 4px; text-align: right; width: 15%;">Valor Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${htmlServicos || '<tr><td colspan="7" style="padding:10px; text-align:center; font-style:italic;">Nenhum serviço lançado.</td></tr>'}
                    </tbody>
                </table>
            </div>

            <div style="display: flex; justify-content: space-between; page-break-inside: avoid; border: 1px solid #000; padding: 10px; margin-top: 10px;">
                <div style="width: 50%; font-size: 10px; line-height: 1.5;">
                    <p style="margin: 0;"><strong>Resp. Lançamento:</strong> ${String(os.responsavel || '---').toUpperCase()}</p>
                    <p style="margin: 0;"><strong>Placa:</strong> ${placaDoc}</p>
                </div>
                
                <div style="width: 40%; font-size: 10px; line-height: 1.5;">
                    <div style="display: flex; justify-content: space-between;"><span>Total de Peças (+):</span> <span>R$ ${tPecas.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span></div>
                    <div style="display: flex; justify-content: space-between;"><span>Total Serviços (+):</span> <span>R$ ${tServ.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span></div>
                    <div style="display: flex; justify-content: space-between;"><span>Outros Vlrs (+):</span> <span>R$ ${Number(os.outros_valores || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span></div>
                    <div style="display: flex; justify-content: space-between; color: red;"><span>Desconto (-):</span> <span>R$ ${Number(os.desconto || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span></div>
                    <div style="display: flex; justify-content: space-between; font-weight: 900; font-size: 13px; border-top: 1px solid #000; margin-top: 4px; padding-top: 4px;">
                        <span>Total Líquido (=):</span> <span>R$ ${Math.max(0, tPecas + tServ + Number(os.outros_valores || 0) - Number(os.desconto || 0)).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                    </div>
                </div>
            </div>
            
            <div style="margin-top: 60px; text-align: center; border-top: 1px solid #000; width: 350px; margin-left: auto; margin-right: auto; padding-top: 5px; font-weight: bold; font-size: 12px; page-break-inside: avoid;">
                Assinatura do Cliente
            </div>
        </div>
    `;
};

window.imprimirOsDaLista = async function(event, id) {
    if(event) { event.preventDefault(); event.stopPropagation(); }
    const menu = document.getElementById(`menu-${id}`);
    if(menu) menu.classList.add('hidden');

    try {
        const { data: os, error } = await supabase.from('ordens_servico').select('*').eq('id', id).single();
        if (error) throw error;
        const { data: itens, error: erroItens } = await supabase.from('itens_orcamento').select('*').eq('os_id', id);
        if (erroItens) throw erroItens;

        const conteudo = window.gerarHtmlDocumentoOs(os, itens);
        
        const win = window.open('', '_blank', 'width=1000,height=800');
        win.document.write(`<html><head><title>O.S_${os.numero_os}_${os.placa}</title></head><body style="margin:0;">${conteudo}</body></html>`);
        win.document.close();
        win.focus();
        setTimeout(() => win.print(), 800);
    } catch (e) { 
        console.error(e); 
        alert("Erro ao imprimir O.S.");
    }
};

window.salvarComoPdfDaLista = async function(event, id) {
    if(event) { event.preventDefault(); event.stopPropagation(); }
    const menu = document.getElementById(`menu-${id}`);
    if(menu) menu.classList.add('hidden');
    
    if (window.mostrarToast) window.mostrarToast("Gerando Arquivo PDF...", "aviso");

    try {
        const { data: os, error } = await supabase.from('ordens_servico').select('*').eq('id', id).single();
        if (error) throw error;
        const { data: itens, error: erroItens } = await supabase.from('itens_orcamento').select('*').eq('os_id', id);
        if (erroItens) throw erroItens;

        const conteudoHtml = window.gerarHtmlDocumentoOs(os, itens);
        const divContainer = document.createElement('div');
        divContainer.innerHTML = conteudoHtml;

        const osNum = String(os.numero_os || os.id || '0000').padStart(4, '0');
        const nomeArquivo = `O.S_${osNum}_${os.placa}.pdf`;

        const opt = {
            margin: 0.1, filename: nomeArquivo, image: { type: 'jpeg', quality: 1 },
            html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
        };

        html2pdf().set(opt).from(divContainer.firstElementChild).save().then(() => {
            if (window.mostrarToast) window.mostrarToast("PDF Salvo com Sucesso!", "sucesso");
        });
    } catch (e) { 
        console.error(e); 
        alert("Erro ao gerar PDF.");
    }
};

window.enviarWhatsAppDaLista = async function(event, id, celular) {
    if(event) { event.preventDefault(); event.stopPropagation(); }
    const menu = document.getElementById(`menu-${id}`);
    if(menu) menu.classList.add('hidden');

    const telLimpo = String(celular || '').replace(/\D/g, '');
    if (telLimpo.length < 10) {
        if (window.mostrarToast) window.mostrarToast("Cliente sem WhatsApp válido!", "erro");
        else alert("Cliente sem celular cadastrado.");
        return;
    }

    if (window.mostrarToast) window.mostrarToast("Gerando links seguros...", "aviso");

    try {
        const { data: os, error } = await supabase.from('ordens_servico').select('*').eq('id', id).single();
        if (error) throw error;
        const { data: itens, error: erroItens } = await supabase.from('itens_orcamento').select('*').eq('os_id', id);
        if (erroItens) throw erroItens;

        const conteudoHtml = window.gerarHtmlDocumentoOs(os, itens);
        const divContainer = document.createElement('div');
        divContainer.innerHTML = conteudoHtml;

        const osNum = String(os.numero_os || os.id || '0000').padStart(4, '0');
        const nomeArquivo = `O.S_${osNum}_${os.placa}.pdf`;

        const opt = { margin: 0.1, filename: nomeArquivo, image: { type: 'jpeg', quality: 1 }, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' } };
        const pdfBlob = await html2pdf().set(opt).from(divContainer.firstElementChild).output('blob');

        const { error: uploadError } = await supabase.storage.from('pdfs-os').upload(nomeArquivo, pdfBlob, { contentType: 'application/pdf', upsert: true });
        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage.from('pdfs-os').getPublicUrl(nomeArquivo);
        const linkPdf = publicUrlData.publicUrl;

        const cliente = String(os.cliente || 'Cliente').trim();
        const calcTotalGeral = Math.max(0, Number(os.total_pecas || 0) + Number(os.total_servicos || 0) + Number(os.outros_valores || 0) - Number(os.desconto || 0));

        const urlL = os.url_laudo || os.link_laudo;
        const linkLaudoTexto = urlL ? `\n*Acesse também o Laudo Técnico e Evidências:* \n${urlL}\n` : '';

        const message = `Olá, *${cliente}*!\n\nAqui é da *Brasil Diesel Performance*.\nSua Ordem de Serviço *#${osNum}* (Placa: ${window.formatarPlaca(os.placa)}) foi atualizada.\n\n*Situação Atual:* ${os.situacao || 'Aberto'}\n*Valor Total:* R$ ${calcTotalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n\n *Acesse seu Orçamento Detalhado em PDF aqui:* \n${linkPdf}\n${linkLaudoTexto}\nQualquer dúvida, estamos à disposição!`;
        
        const url = `https://wa.me/55${telLimpo}?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');

    } catch (e) {
        console.error(e);
        alert("Erro ao processar a nuvem do WhatsApp.");
    }
};

window.visualizarNotificacaoLab = async function(event, osId, osNum, placa, situacao) {
    if(event) { event.preventDefault(); event.stopPropagation(); }
    const confirmou = await window.abrirConfirmacao("Aviso do Laboratório", "O laboratório atualizou esta O.S. Deseja remover o aviso e ir para o painel do laboratório?", "aviso");
    if (!confirmou) return;

    try {
        await supabase.from('ordens_servico').update({ lab_atualizado: false }).eq('id', osId);
        window.carregarOrdensServico(); 
        
        const btnLab = document.querySelector('.nav-btn[data-tela="lab"]');
        if (btnLab) btnLab.click();
        
        setTimeout(() => {
            if (typeof window.abrirGestaoPecas === 'function') {
                window.abrirGestaoPecas(osId, osNum, placa, situacao);
            }
        }, 600);
    } catch (e) { 
        console.error(e); 
        alert("Erro ao limpar notificação do Laboratório.");
    }
};

// =========================================================================
// 5. BANCO DE DADOS, TABELA PRINCIPAL E VIGILÂNCIA REALTIME
// =========================================================================

window.ativarVigilanciaRealtime = function() {
    if(window.osRealtimeAtivo) return; 
    window.osRealtimeAtivo = true;

    supabase.channel('vigilancia-ordens')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'ordens_servico' }, payload => {
            const tabela = document.getElementById('tabela-ordens-servico');
            if (tabela) {
                console.log('📡 Atualização Realtime Recebida! Atualizando a tabela...');
                window.carregarOrdensServico(true); 
            }
        })
        .subscribe((status) => {
            if(status === 'SUBSCRIBED') {
                console.log('📡 Radar Realtime de O.S Ativado com Sucesso!');
            }
        });
};

window.carregarOrdensServico = async function(isSilencioso = false) {
    const tabela = document.getElementById('tabela-ordens-servico');
    if (!tabela) return;

    if(!isSilencioso) {
        tabela.innerHTML = '<tr><td colspan="7" class="text-center p-8 text-gray-500 font-bold">A carregar base de dados...</td></tr>';
    }
    
    window.ativarVigilanciaRealtime(); 

    try {
        const { data, error } = await supabase.from('ordens_servico').select('*, itens_orcamento(*)').order('id', { ascending: false });
        if (error) throw error;

        if (!data || data.length === 0) {
            tabela.innerHTML = '<tr><td colspan="7" class="text-center p-8 text-gray-400 font-bold italic">Nenhuma O.S. registada.</td></tr>';
            return;
        }

        const ordensAtivas = data.filter(os => os.situacao !== 'Fechado');
        const ordensFechadas = data.filter(os => os.situacao === 'Fechado');
        const dadosOrdenados = [...ordensAtivas, ...ordensFechadas];

        tabela.innerHTML = dadosOrdenados.map(os => {
            const numeroFormatado = String(os.numero_os || os.id).padStart(4, '0');
            
            let dataFormatada = '---';
            if (os.data_hora) {
                const d = new Date(os.data_hora);
                dataFormatada = d.toLocaleDateString('pt-BR', { 
                    day: '2-digit', month: '2-digit', year: 'numeric', 
                    hour: '2-digit', minute: '2-digit' 
                }).replace(',', '');
            }

            const placaFormatada = window.formatarPlaca(os.placa);
            const clienteFormatado = String(os.cliente || '---').trim().toUpperCase();
            const modeloUpper = String(os.modelo || '---').trim().toUpperCase();
            const veiculoFormatado = os.ano ? `${modeloUpper} - ${os.ano}` : modeloUpper;
            
            const qtdItens = os.itens_orcamento ? os.itens_orcamento.reduce((soma, i) => soma + (Number(i.quantidade) || 1), 0) : 0;
            const tPecas = os.itens_orcamento ? os.itens_orcamento.filter(i => i.tipo === 'Peça').reduce((a, i) => a + (Number(i.subtotal) || 0), 0) : 0;
            const tServ = os.itens_orcamento ? os.itens_orcamento.filter(i => i.tipo === 'Serviço').reduce((a, i) => a + (Number(i.subtotal) || 0), 0) : 0;
            const totalMatematico = Math.max(0, tPecas + tServ + Number(os.outros_valores || 0) - Number(os.desconto || 0));
            
            let iconeNotificacao = os.lab_atualizado ? 
                `<button type="button" onclick="window.visualizarNotificacaoLab(event, ${os.id}, '${numeroFormatado}', '${os.placa}', '${os.situacao}')" class="absolute left-3 top-1/2 transform -translate-y-1/2 text-red-500 hover:text-red-700 animate-pulse flex-shrink-0" title="Laboratório enviou atualizações!">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 drop-shadow-sm" viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" /></svg>
                </button>` : '';

            const bgStatus = window.obterCoresStatus(os.situacao);

            return `
                <tr class="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-150 ${os.situacao === 'Fechado' ? 'opacity-70 grayscale-[30%]' : ''}">
                    <td class="p-4 font-mono font-bold text-gray-500 dark:text-gray-400">#${numeroFormatado}</td>
                    
                    <td class="p-4 text-xs font-mono text-gray-600 dark:text-gray-400 whitespace-nowrap">${dataFormatada}</td>
                    
                    <td class="p-4 text-center relative">
                        ${iconeNotificacao}
                        <span class="font-black text-[#1a428a] dark:text-blue-400 tracking-wider text-lg whitespace-nowrap">${placaFormatada}</span>
                    </td>
                    
                    <td class="p-4 text-sm text-gray-700 dark:text-gray-300">
                        <p class="font-bold text-gray-800 dark:text-white">${clienteFormatado}</p>
                        <p class="text-xs text-gray-500 dark:text-gray-400 font-medium">${veiculoFormatado}</p>
                    </td>
                    
                    <td class="p-4 text-right text-sm">
                        <p class="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">Itens: <span class="font-bold text-gray-800 dark:text-white">${qtdItens}</span></p>
                        <p class="font-black text-[#1a428a] dark:text-blue-400 tracking-wide">R$ ${totalMatematico.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </td>
                    
                    <td class="p-4 text-center">
                        <select onchange="window.alterarStatusOsInline(${os.id}, this)" class="${bgStatus} text-[10px] uppercase px-2 py-1.5 rounded-lg font-black tracking-wider outline-none cursor-pointer text-center text-center-last border shadow-sm transition-all w-full max-w-[140px]">
                            <option value="Aberto" style="background-color: #E0F2FE; color: #0369A1; font-weight: 800;" ${os.situacao === 'Aberto' ? 'selected' : ''}>ABERTO</option>
                            <option value="Orçamento" style="background-color: #F3E8FF; color: #6B21A8; font-weight: 800;" ${os.situacao === 'Orçamento' ? 'selected' : ''}>ORÇAMENTO</option>
                            <option value="Aguardando Autorização" style="background-color: #FFEDD5; color: #C2410C; font-weight: 800;" ${os.situacao === 'Aguardando Autorização' ? 'selected' : ''}>AGUAR. AUTORIZAÇÃO</option>
                            <option value="Aguardando Peça" style="background-color: #FEF3C7; color: #B45309; font-weight: 800;" ${os.situacao === 'Aguardando Peça' ? 'selected' : ''}>AGUAR. PEÇA</option>
                            <option value="Aguardando Pagamento" style="background-color: #FEF08A; color: #854D0E; font-weight: 800;" ${os.situacao === 'Aguardando Pagamento' ? 'selected' : ''}>AGUAR. PAGAMENTO</option>
                            <option value="Autorizado" style="background-color: #DCFCE7; color: #15803D; font-weight: 800;" ${os.situacao === 'Autorizado' ? 'selected' : ''}>AUTORIZADO</option>
                            <option value="Em Execução" style="background-color: #E0E7FF; color: #3730A3; font-weight: 800;" ${os.situacao === 'Em Execução' ? 'selected' : ''}>EM EXECUÇÃO</option>
                            <option value="Garantia" style="background-color: #CCFBF1; color: #0F766E; font-weight: 800;" ${os.situacao === 'Garantia' ? 'selected' : ''}>GARANTIA</option>
                            <option value="Fechado" style="background-color: #E5E7EB; color: #1F2937; font-weight: 800;" ${os.situacao === 'Fechado' ? 'selected' : ''}>FECHADO</option>
                            <option value="Não Usar" style="background-color: #FEE2E2; color: #991B1B; font-weight: 800;" ${os.situacao === 'Não Usar' ? 'selected' : ''}>CANCELADA</option>
                            <option value="Recusado" style="background-color: #FECACA; color: #B91C1C; font-weight: 800;" ${os.situacao === 'Recusado' ? 'selected' : ''}>RECUSADO</option>
                        </select>
                    </td>
                    <td class="p-4">
                        <div class="flex items-center justify-center gap-2 relative dropdown-container">
                            <button type="button" onclick="window.visualizarOs(event, ${os.id})" class="text-blue-500 hover:text-blue-700 bg-white hover:bg-blue-50 dark:bg-gray-800 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600 p-2 rounded-lg transition-all shadow-sm" title="Ver Detalhes">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                            </button>
                            <button type="button" onclick="window.editarOs(event, ${os.id})" class="text-amber-500 hover:text-amber-700 bg-white hover:bg-amber-50 dark:bg-gray-800 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600 p-2 rounded-lg transition-all shadow-sm" title="Editar O.S">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </button>
                            <button type="button" onclick="window.excluirOs(event, ${os.id}, '${os.placa}', '${numeroFormatado}')" class="text-red-500 hover:text-red-700 bg-white hover:bg-red-50 dark:bg-gray-800 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600 p-2 rounded-lg transition-all shadow-sm" title="Eliminar O.S">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>

                            <button type="button" onclick="window.toggleDrop(event, ${os.id}, this)" class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 border border-transparent dark:border-gray-600 p-2 rounded-lg transition-all shadow-sm" title="Mais Opções">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" /></svg>
                            </button>

                            <div id="menu-${os.id}" class="menu-acao-os hidden fixed w-48 bg-white dark:bg-[#1e293b] rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 py-2 text-left" style="min-width: 180px; z-index: 99999;">
                                <button type="button" onclick="window.imprimirOsDaLista(event, ${os.id})" class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 font-bold flex items-center gap-2"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2-2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg> Imprimir O.S</button>
                                <button type="button" onclick="window.salvarComoPdfDaLista(event, ${os.id})" class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 font-bold flex items-center gap-2"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg> Baixar PDF</button>
                                
                                <button type="button" onclick="window.enviarWhatsAppDaLista(event, ${os.id}, '${os.celular || ''}')" class="w-full text-left px-4 py-2 text-sm text-[#25D366] hover:bg-green-50 dark:hover:bg-green-900/20 font-bold flex items-center gap-2 border-t border-gray-100 dark:border-gray-700 mt-1">
                                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg> WhatsApp
                                </button>
                            </div>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (err) { console.error("Erro ao listar O.S:", err); }
};

// =========================================================================
// 6. GESTÃO DO MODAL DE O.S. E BOTÃO DESCARTAR
// =========================================================================
window.abrirModalNovaOs = async function() {
    window.osEmEdicaoId = null; window.osNumeroAtual = null;
    window.itensOrcamento = []; window.modoLeitura = false; window.itemEmEdicaoId = null;
    document.getElementById('form-nova-os')?.reset();
    
    document.getElementById('outros-valores').value = '0,00';
    document.getElementById('outros-porcentagem').innerText = '+ 0.00%';
    document.getElementById('desconto-valor').value = '0,00';
    document.getElementById('desconto-porcentagem').innerText = 'Representa 0.00%';
    
    window.carregarDatalists();
    
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            document.getElementById('responsavel_os').value = session.user.email.split('@')[0].toUpperCase();
        } else {
            document.getElementById('responsavel_os').value = document.getElementById('usuario-logado')?.innerText || 'SISTEMA';
        }
    } catch (e) { document.getElementById('responsavel_os').value = 'SISTEMA'; }

    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('data_hora').value = now.toISOString().slice(0, 16); 
    
    const sel = document.getElementById('situacao');
    if(sel) { sel.value = 'Aberto'; window.atualizarCorSelectSituacao(sel); }
    
    window.alternarModoLeitura(false);
    document.getElementById('modal-os')?.classList.remove('hidden');
    document.getElementById('modal-os')?.classList.add('flex');
    window.configurarRastreioAlteracoes();
};

window.buscarDadosOs = async function(id) {
    try {
        const { data: os, error } = await supabase.from('ordens_servico').select('*').eq('id', id).single();
        if (error) throw error;

        window.osEmEdicaoId = os.id;
        window.osEmEdicaoNumero = os.numero_os || os.id;
        window.osNumeroAtual = os.numero_os || os.id;
        window.itemEmEdicaoId = null;

        const setVal = (idEl, val) => { const el = document.getElementById(idEl); if(el) el.value = val; };

        setVal('data_hora', os.data_hora ? String(os.data_hora).slice(0, 16) : '');
        setVal('responsavel_os', String(os.responsavel || 'SISTEMA'));
        setVal('setor_destino', String(os.setor_destino || 'Pátio'));
        setVal('placa', window.formatarPlaca(os.placa));
        setVal('modelo', String(os.modelo || '').trim());
        setVal('marca', String(os.marca || '').trim());
        setVal('ano', String(os.ano || '').trim());
        setVal('km_veiculo', String(os.km_veiculo || '').trim());
        setVal('cpf_cnpj', String(os.cpf_cnpj || '').trim());
        setVal('inscricao_estadual', String(os.inscricao_estadual || '').trim());
        setVal('cliente', String(os.cliente || '').trim());
        setVal('celular', String(os.celular || '').trim());
        setVal('cliente_email', String(os.email || '').trim());
        setVal('cep', String(os.cep || '').trim());
        setVal('endereco', String(os.endereco || '').trim());
        setVal('bairro', String(os.bairro || '').trim());
        setVal('cidade', String(os.cidade || '').trim());
        setVal('numero_end', String(os.numero_end || '').trim());
        setVal('complemento', String(os.complemento || '').trim());
        setVal('outros-valores', Number(os.outros_valores || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
        setVal('desconto-tipo', String(os.desconto_tipo || 'total'));
        setVal('desconto-valor', Number(os.desconto || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
        
        const sel = document.getElementById('situacao');
        if(sel) { sel.value = os.situacao || 'Aberto'; window.atualizarCorSelectSituacao(sel); }
        setVal('defeito', String(os.defeito || '').trim());

        const { data: itens } = await supabase.from('itens_orcamento').select('*').eq('os_id', id);
        window.itensOrcamento = itens ? itens.map(i => ({ id: i.id || Date.now(), tipo: i.tipo, descricao: i.descricao, qtd: i.quantidade, valorUnitario: i.valor_unitario, subtotal: i.subtotal, concluido: i.concluido })) : [];

        window.atualizarTituloModalOs(window.osNumeroAtual, os.placa);
        window.atualizarTopHeaderVisualizacao(os);
    } catch (error) {
        console.error("ERRO GRAVE AO BUSCAR DADOS:", error);
        throw error; 
    }
};

window.salvarOs = async function(event) {
    if(event) event.preventDefault();
    if(window.modoLeitura) return;

    const getVal = (idEl, fallback='') => { const el = document.getElementById(idEl); return el ? el.value : fallback; };

    const placaBruta = getVal('placa');
    const placa = window.formatarPlaca(placaBruta);
    if (!window.validarPlacaBrasil(placa)) {
        if (window.mostrarToast) window.mostrarToast("Placa inválida!", "erro");
        document.getElementById('placa')?.focus(); return;
    }
    
    const tPecas = window.itensOrcamento.filter(i => i.tipo === 'Peça').reduce((acc, i) => acc + (Number(i.subtotal) || 0), 0);
    const tServ = window.itensOrcamento.filter(i => i.tipo === 'Serviço').reduce((acc, i) => acc + (Number(i.subtotal) || 0), 0);
    const valOutros = parseFloat(getVal('outros-valores').replace(/\./g, '').replace(',', '.')) || 0;
    const valDesconto = parseFloat(getVal('desconto-valor').replace(/\./g, '').replace(',', '.')) || 0;
    const calcTotalGeral = Math.max(0, tPecas + tServ + valOutros - valDesconto);

    const dadosOs = {
        data_hora: getVal('data_hora'),
        responsavel: getVal('responsavel_os', 'SISTEMA'),
        setor_destino: getVal('setor_destino', 'Pátio'),
        placa: placa, veiculo_placa: placa.replace('-', ''),
        modelo: String(getVal('modelo')).trim(), 
        marca: String(getVal('marca')).trim(),
        ano: String(getVal('ano')).trim(), 
        km_veiculo: String(getVal('km_veiculo')).trim(),
        cpf_cnpj: String(getVal('cpf_cnpj')).trim(),
        inscricao_estadual: String(getVal('inscricao_estadual')).trim(),
        cliente: String(getVal('cliente')).trim(), 
        celular: String(getVal('celular')).trim(),
        email: String(getVal('cliente_email')).trim(), 
        cep: String(getVal('cep')).trim(),
        endereco: String(getVal('endereco')).trim(), 
        bairro: String(getVal('bairro')).trim(),
        cidade: String(getVal('cidade')).trim(), 
        numero_end: String(getVal('numero_end')).trim(),
        complemento: String(getVal('complemento')).trim(), 
        situacao: getVal('situacao', 'Aberto'),
        status: getVal('situacao', 'Aberto'), 
        defeito: String(getVal('defeito')).trim(),
        total_pecas: tPecas,
        total_servicos: tServ,
        outros_valores: valOutros,
        desconto_tipo: getVal('desconto-tipo', 'total'),
        desconto: valDesconto,
        total_geral: calcTotalGeral
    };

    try {
        let osId = null;
        if (window.osEmEdicaoId) {
            const { error: errUpdate } = await supabase.from('ordens_servico').update(dadosOs).eq('id', window.osEmEdicaoId);
            if (errUpdate) throw errUpdate;
            osId = window.osEmEdicaoId;
            const { error: errDelete } = await supabase.from('itens_orcamento').delete().eq('os_id', osId);
            if (errDelete) throw errDelete;
        } else {
            const { data: nova, error: errInsert } = await supabase.from('ordens_servico').insert([dadosOs]).select().single();
            if (errInsert) throw errInsert;
            osId = nova.id;
        }

        if (window.itensOrcamento.length > 0) {
            const itensDB = window.itensOrcamento.map(i => ({
                os_id: osId, tipo: i.tipo, descricao: i.descricao, quantidade: i.qtd,
                valor_unitario: i.valorUnitario, subtotal: i.subtotal, concluido: i.concluido || false
            }));
            const { error: errItens } = await supabase.from('itens_orcamento').insert(itensDB);
            if (errItens) throw errItens;
        }
        
        if (window.mostrarToast) window.mostrarToast("Ordem de Serviço salva!", "sucesso");
        window.fecharModalOsDireto();
        window.carregarOrdensServico();
    } catch (err) {
        console.error("FALHA DE INTEGRIDADE NO BANCO:", err);
        alert("ERRO AO SALVAR! Verifique o console. Detalhe: " + err.message);
    }
};

window.editarOs = async function(event, id) {
    if(event) { event.preventDefault(); event.stopPropagation(); }
    try { 
        window.modoLeitura = false; 
        await window.buscarDadosOs(id); 
        window.alternarModoLeitura(false); 
        window.carregarDatalists(); 
        window.configurarRastreioAlteracoes(); 
        document.getElementById('modal-os')?.classList.remove('hidden'); 
        document.getElementById('modal-os')?.classList.add('flex'); 
    } catch (e) {
        console.error("ERRO AO ABRIR EDIÇÃO:", e);
        alert("Falha Crítica ao tentar Editar O.S. Detalhe: " + e.message);
    }
};

window.visualizarOs = async function(event, id) {
    if(event) { event.preventDefault(); event.stopPropagation(); }
    try { 
        window.modoLeitura = true; 
        await window.buscarDadosOs(id); 
        window.alternarModoLeitura(true); 
        document.getElementById('modal-os')?.classList.remove('hidden'); 
        document.getElementById('modal-os')?.classList.add('flex'); 
    } catch (e) {
        console.error("ERRO AO ABRIR VISUALIZAÇÃO:", e);
        alert("Falha Crítica ao tentar Visualizar O.S. Detalhe: " + e.message);
    }
};

window.excluirOs = async function(event, id, placa, numeroOs) {
    if(event) { event.preventDefault(); event.stopPropagation(); }
    const confirmou = await window.abrirConfirmacao("Excluir O.S.", `Deseja eliminar a O.S. #${numeroOs}?`, "perigo");
    if (!confirmou) return;
    try { 
        await supabase.from('itens_orcamento').delete().eq('os_id', id); 
        await supabase.from('ordens_servico').delete().eq('id', id); 
        if (window.mostrarToast) window.mostrarToast("O.S. eliminada!", "sucesso"); 
        window.carregarOrdensServico(); 
    } catch (e) { 
        alert("Erro ao eliminar O.S."); 
    }
};

window.configurarRastreioAlteracoes = function() {
    const form = document.getElementById('form-nova-os');
    if (!form) return;
    window.formAlterado = false;
    window.atualizarVisibilidadeBotoesFechamento();
    form.oninput = () => window.marcarComoAlterado();
    form.onchange = () => window.marcarComoAlterado();
};

window.marcarComoAlterado = function() {
    if (!window.formAlterado && !window.modoLeitura) { window.formAlterado = true; window.atualizarVisibilidadeBotoesFechamento(); }
};

window.atualizarVisibilidadeBotoesFechamento = function() {
    const btnX = document.getElementById('btn-fechar-x');
    const btnFecharOs = document.getElementById('btn-fechar-os');
    const btnCancelar = document.getElementById('btn-cancelar-alteracoes'); 
    
    if (window.modoLeitura) {
        if(btnX) btnX.classList.remove('hidden');
        if(btnFecharOs) btnFecharOs.classList.add('hidden');
        if(btnCancelar) btnCancelar.classList.add('hidden');
        return;
    }
    
    if (window.formAlterado) {
        if(btnX) btnX.classList.add('hidden');
        if(btnCancelar) btnCancelar.classList.remove('hidden');
    } else {
        if(btnX) btnX.classList.remove('hidden');
        if(btnCancelar) btnCancelar.classList.add('hidden');
    }
};

window.tentarCancelarOs = async function() {
    const confirmar = await window.abrirConfirmacao("Descartar Alterações", "Tem certeza que deseja sair sem salvar as modificações feitas nesta O.S?", "aviso");
    if (confirmar) window.fecharModalOsDireto();
};

window.fecharModalOsSeguro = async function() {
    if (window.formAlterado && !window.modoLeitura) {
        const confirmar = await window.abrirConfirmacao("Descartar", "Existem dados não salvos. Deseja fechar?", "aviso");
        if (!confirmar) return;
    }
    window.fecharModalOsDireto();
};

window.fecharModalOsDireto = function() {
    window.formAlterado = false;
    document.getElementById('modal-os')?.classList.add('hidden');
    document.getElementById('modal-os')?.classList.remove('flex');
};

window.calcularSubtotalItem = function() {
    const qtd = parseInt(document.getElementById('item-qtd').value) || 1;
    const valorTxt = document.getElementById('item-valor').value || '0,00';
    const vNum = parseFloat(valorTxt.replace(/\./g, '').replace(',', '.'));
    const subtotal = qtd * vNum;
    document.getElementById('item-subtotal').value = subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

window.editarItemOrcamento = function(id) {
    if (window.modoLeitura) return;
    const item = window.itensOrcamento.find(i => i.id === id);
    if (!item) return;

    document.getElementById('item-tipo').value = item.tipo;
    document.getElementById('item-descricao').value = item.descricao;
    document.getElementById('item-qtd').value = item.qtd;
    document.getElementById('item-valor').value = item.valorUnitario.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    document.getElementById('item-subtotal').value = item.subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    window.itemEmEdicaoId = id;
};

// =========================================================================
// MOTOR DE INTELIGÊNCIA E CÁLCULOS
// =========================================================================
window.verificarMotorInteligencia = function(descricaoNova) {
    const desc = descricaoNova.toLowerCase();
    let sugestao = null; let tipoSugestao = 'Serviço';
    
    if (desc.includes('limpeza de tanque')) {
        sugestao = 'ABASTECIMENTO / COMBUSTÍVEL (DIESEL)';
        tipoSugestao = 'Peça';
    } else if (desc.includes('teste de injetor') || desc.includes('teste de bico')) {
        const temRemocao = window.itensOrcamento.some(i => i.descricao.toLowerCase().includes('remoç') || i.descricao.toLowerCase().includes('remoc'));
        if (!temRemocao) {
            sugestao = 'REMOÇÃO E INSTALAÇÃO DE INJETORES';
            tipoSugestao = 'Serviço';
        }
    }

    if (sugestao) {
        document.getElementById('msg-inteligencia').innerHTML = `Notei que você adicionou <strong class="text-amber-700">"${descricaoNova.toUpperCase()}"</strong>.<br>Deseja adicionar também <strong class="text-amber-700">"${sugestao}"</strong> para uma O.S. completa?`;
        
        const btnAceitar = document.getElementById('btn-aceitar-sugestao');
        btnAceitar.onclick = () => {
            document.getElementById('item-tipo').value = tipoSugestao;
            document.getElementById('item-descricao').value = sugestao;
            document.getElementById('item-qtd').value = 1;
            document.getElementById('item-valor').focus();
            document.getElementById('modal-inteligencia').classList.add('hidden');
        };
        
        document.getElementById('modal-inteligencia').classList.remove('hidden');
        document.getElementById('modal-inteligencia').classList.add('flex');
    }
};

window.adicionarItemOrcamento = function() {
    if (window.modoLeitura) return;
    const tipo = document.getElementById('item-tipo').value;
    const desc = document.getElementById('item-descricao').value.trim().toUpperCase();
    const qtd = parseInt(document.getElementById('item-qtd').value) || 1;
    const valorTxt = document.getElementById('item-valor').value;

    if (!desc || !valorTxt || valorTxt === "0,00") {
        if (window.mostrarToast) window.mostrarToast("Informe descrição e valor.", "aviso");
        return;
    }

    const vNum = parseFloat(valorTxt.replace(/\./g, '').replace(',', '.'));
    const subtotal = qtd * vNum;

    if (window.itemEmEdicaoId) {
        const index = window.itensOrcamento.findIndex(i => i.id === window.itemEmEdicaoId);
        if (index !== -1) window.itensOrcamento[index] = { ...window.itensOrcamento[index], tipo: tipo, descricao: desc, qtd: qtd, valorUnitario: vNum, subtotal: subtotal };
        window.itemEmEdicaoId = null;
    } else {
        window.itensOrcamento.push({ id: Date.now(), tipo, descricao: desc, qtd, valorUnitario: vNum, subtotal: subtotal, concluido: false });
        window.verificarMotorInteligencia(desc);
    }

    document.getElementById('item-descricao').value = '';
    document.getElementById('item-valor').value = '';
    document.getElementById('item-qtd').value = '1';
    document.getElementById('item-subtotal').value = '';
    document.getElementById('item-descricao').focus();

    window.renderizarTabelaOrcamento();
    window.marcarComoAlterado();
};

window.removerItemOrcamento = async function(id) {
    if (window.modoLeitura) return;
    const confirmou = await window.abrirConfirmacao("Remover", "Excluir item?", "perigo");
    if (!confirmou) return;
    window.itensOrcamento = window.itensOrcamento.filter(i => i.id !== id);
    window.renderizarTabelaOrcamento();
    window.marcarComoAlterado();
};

window.renderizarTabelaOrcamento = function() {
    const tbody = document.getElementById('tbody-orcamento');
    if (!tbody) return;

    if (window.itensOrcamento.length === 0) {
        const colspan = window.modoLeitura ? 6 : 7;
        tbody.innerHTML = `<tr><td colspan="${colspan}" class="p-6 text-center text-gray-400 font-medium transition-all">Nenhum item adicionado.</td></tr>`;
        return;
    }

    tbody.innerHTML = window.itensOrcamento.map((item, idx) => {
        const tdAcao = window.modoLeitura ? '' : `
            <td class="p-3 text-center whitespace-nowrap">
                <button type="button" onclick="window.editarItemOrcamento(${item.id})" class="text-blue-500 hover:text-blue-700 mr-2 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                <button type="button" onclick="window.removerItemOrcamento(${item.id})" class="text-red-500 font-black text-xl hover:text-red-700 transition-colors">&times;</button>
            </td>`;
            
        return `
        <tr class="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-[#0f172a] transition-all">
            <td class="p-3 text-center font-mono font-bold text-gray-400">${idx + 1}</td>
            <td class="p-3 text-center"><span class="px-2.5 py-1 text-[10px] uppercase rounded-lg font-bold ${item.tipo === 'Peça' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400'}">${item.tipo}</span></td>
            <td class="p-3 font-bold text-gray-800 dark:text-white text-xs uppercase">${item.descricao}</td>
            <td class="p-3 text-center font-mono font-bold text-gray-700 dark:text-gray-300">${item.qtd}</td>
            <td class="p-3 text-right font-mono text-gray-600 dark:text-gray-400">${item.valorUnitario.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
            <td class="p-3 text-right font-mono font-bold text-[#1a428a] dark:text-[#3b82f6]">${item.subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
            ${tdAcao}
        </tr>`;
    }).join('');

    window.atualizarTotaisOrcamento();
};

window.atualizarTotaisOrcamento = function() {
    let tPecas = 0, tServ = 0, qtdTotal = 0;
    window.itensOrcamento.forEach(i => {
        qtdTotal += i.qtd;
        if (i.tipo === 'Peça') tPecas += (Number(i.subtotal) || 0);
        if (i.tipo === 'Serviço') tServ += (Number(i.subtotal) || 0);
    });

    const getVal = (id, f) => { const el = document.getElementById(id); return el ? el.value : f; };
    const txtOutros = getVal('outros-valores', '0,00');
    const tipoDesconto = getVal('desconto-tipo', 'total');
    const txtDesconto = getVal('desconto-valor', '0,00');
    
    let vOutros = parseFloat(txtOutros.replace(/\./g, '').replace(',', '.')) || 0;
    let vDesconto = parseFloat(txtDesconto.replace(/\./g, '').replace(',', '.')) || 0;

    const subtotalBase = tPecas + tServ;
    
    let percentualOutros = 0;
    if (subtotalBase > 0 && vOutros > 0) {
        percentualOutros = (vOutros / subtotalBase) * 100;
    }
    const labelOutrosPct = document.getElementById('outros-porcentagem');
    if (labelOutrosPct) labelOutrosPct.innerText = `+ ${percentualOutros.toFixed(2)}%`;

    const subtotalBruto = subtotalBase + vOutros; 
    
    if (tipoDesconto === 'pecas' && vDesconto > tPecas) {
        vDesconto = tPecas; const el = document.getElementById('desconto-valor'); if(el) el.value = vDesconto.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    } else if (tipoDesconto === 'servicos' && vDesconto > tServ) {
        vDesconto = tServ; const el = document.getElementById('desconto-valor'); if(el) el.value = vDesconto.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    } else if (tipoDesconto === 'total' && vDesconto > subtotalBruto) {
        vDesconto = subtotalBruto; const el = document.getElementById('desconto-valor'); if(el) el.value = vDesconto.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    }
    
    let percentualDesconto = 0;
    let baseCalculo = subtotalBruto;
    if (tipoDesconto === 'pecas') baseCalculo = tPecas;
    if (tipoDesconto === 'servicos') baseCalculo = tServ;

    if (baseCalculo > 0 && vDesconto > 0) {
        percentualDesconto = (vDesconto / baseCalculo) * 100;
    }
    
    const labelPorcentagem = document.getElementById('desconto-porcentagem');
    if (labelPorcentagem) labelPorcentagem.innerText = `Representa ${percentualDesconto.toFixed(2)}%`;

    const totalGeral = subtotalBruto - vDesconto;

    const setTxt = (id, val) => { const el = document.getElementById(id); if(el) el.innerText = val; };
    setTxt('qtd-total-itens', qtdTotal);
    setTxt('total-pecas', 'R$ ' + tPecas.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
    setTxt('total-servicos', 'R$ ' + tServ.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
    setTxt('total-geral', 'R$ ' + Math.max(0, totalGeral).toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
};

// =========================================================================
// 7. FECHAMENTO FINANCEIRO E PARCELAMENTO (MÓDULO EDITÁVEL)
// =========================================================================
window.abrirModalFechamento = async function() {
    if(window.itensOrcamento.length === 0) {
        if(window.mostrarToast) window.mostrarToast("Não é possível fechar uma O.S. vazia.", "aviso");
        return;
    }
    
    const eventoMock = { preventDefault: () => {} };
    await window.salvarOs(eventoMock); 
    if(!window.osEmEdicaoId) return;

    window.atualizarTotaisOrcamento(); 
    
    const elTotal = document.getElementById('fechamento-total');
    const elGeral = document.getElementById('total-geral');
    if(elTotal && elGeral) elTotal.innerText = elGeral.innerText;

    window.calcularRestanteFechamento();
    
    const setVal = (id, val) => { const el = document.getElementById(id); if(el) el.value = val; };
    setVal('fechamento-vencimento', new Date().toISOString().split('T')[0]);
    
    const agora = new Date(); agora.setMinutes(agora.getMinutes() - agora.getTimezoneOffset());
    setVal('fechamento-conclusao', agora.toISOString().slice(0,16));
    setVal('fechamento-entrega', new Date().toISOString().split('T')[0]);
    
    window.atualizarVencimentoPorOperacao();
    window.calcularGarantia();
    
    const modalFech = document.getElementById('modal-fechamento-os');
    if(modalFech) {
        modalFech.classList.remove('hidden');
        modalFech.classList.add('flex');
    }
};

window.atualizarVencimentoPorOperacao = function() {
    const elOperacao = document.getElementById('fechamento-operacao');
    const inputVenc = document.getElementById('fechamento-vencimento');
    if(!elOperacao || !inputVenc) return;

    const operacao = elOperacao.value;
    const dataAtual = new Date();
    
    if (operacao === 'PIX' || operacao === 'Dinheiro' || operacao === 'Cartão de Débito') {
        dataAtual.setDate(dataAtual.getDate() + 1); 
    } else {
        dataAtual.setMonth(dataAtual.getMonth() + 1); 
    }
    
    const dataLocal = new Date(dataAtual.getTime() - (dataAtual.getTimezoneOffset() * 60000));
    inputVenc.value = dataLocal.toISOString().split('T')[0];
    window.gerarPreviewParcelas();
};

window.calcularRestanteFechamento = function() {
    const elTotal = document.getElementById('fechamento-total');
    const elEntrada = document.getElementById('fechamento-entrada');
    const elRestante = document.getElementById('fechamento-restante');
    
    if(!elTotal || !elEntrada || !elRestante) return;

    const totalTxt = elTotal.innerText;
    const entradaTxt = elEntrada.value || '0,00';
    
    const vTotal = parseFloat(totalTxt.replace('R$ ', '').replace(/\./g, '').replace(',', '.')) || 0;
    const vEntrada = parseFloat(entradaTxt.replace(/\./g, '').replace(',', '.')) || 0;
    
    const restante = Math.max(0, vTotal - vEntrada);
    elRestante.innerText = 'R$ ' + restante.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    window.gerarPreviewParcelas();
};

window.gerarPreviewParcelas = function() {
    const elRestante = document.getElementById('fechamento-restante');
    const elParcelas = document.getElementById('fechamento-parcelas');
    const elOperacao = document.getElementById('fechamento-operacao');
    const elVenciInicial = document.getElementById('fechamento-vencimento');
    const tbody = document.getElementById('tbody-preview-parcelas');
    
    if(!elRestante || !elParcelas || !elOperacao || !elVenciInicial || !tbody) return;

    const restanteTxt = elRestante.innerText;
    const restante = parseFloat(restanteTxt.replace('R$ ', '').replace(/\./g, '').replace(',', '.')) || 0;
    const parcelas = parseInt(elParcelas.value) || 1;
    const operacao = elOperacao.value;
    const venciInicial = elVenciInicial.value;
    
    if(restante <= 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-gray-500 font-bold transition-all">A entrada cobriu o valor total. Sem parcelas pendentes.</td></tr>';
        return;
    }

    const valorParcelaBase = Math.ceil((restante / parcelas) * 100) / 100;
    
    let html = '';
    let dataAtual = new Date(venciInicial || new Date());
    if(venciInicial) dataAtual.setMinutes(dataAtual.getMinutes() + dataAtual.getTimezoneOffset()); 

    for(let i=1; i<=parcelas; i++) {
        let valorDaParcela = valorParcelaBase;
        if (i === parcelas) {
            valorDaParcela = restante - (valorParcelaBase * (parcelas - 1));
            valorDaParcela = Math.round(valorDaParcela * 100) / 100; 
        }

        const dataISO = dataAtual.toISOString().split('T')[0];
        
        const optionsHtml = `
            <option value="PIX" ${operacao === 'PIX' ? 'selected' : ''}>PIX</option>
            <option value="Dinheiro" ${operacao === 'Dinheiro' ? 'selected' : ''}>Dinheiro</option>
            <option value="Cartão de Crédito" ${operacao === 'Cartão de Crédito' ? 'selected' : ''}>Cartão de Crédito</option>
            <option value="Cartão de Débito" ${operacao === 'Cartão de Débito' ? 'selected' : ''}>Cartão de Débito</option>
            <option value="Boleto Bancário" ${operacao === 'Boleto Bancário' ? 'selected' : ''}>Boleto Bancário</option>
        `;

        html += `
            <tr class="border-b border-gray-100 dark:border-gray-800 transition-all text-row-parcela">
                <td class="p-2 text-center font-bold text-gray-700 dark:text-gray-300 num-p-index">${i}/${parcelas}</td>
                <td class="p-2">
                    <input type="date" class="input-data-parcela w-full px-2 py-1.5 text-xs font-mono font-bold border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-[#0f172a] dark:text-white rounded outline-none focus:border-amber-500 transition-colors" value="${dataISO}">
                </td>
                <td class="p-2">
                    <select class="input-op-parcela w-full px-2 py-1.5 text-xs font-bold border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-[#0f172a] dark:text-white rounded outline-none focus:border-amber-500 transition-colors uppercase">
                        ${optionsHtml}
                    </select>
                </td>
                <td class="p-2 text-right">
                    <div class="flex items-center justify-end gap-1">
                        <span class="text-xs font-bold text-gray-500">R$</span>
                        <input type="text" class="input-val-parcela w-24 px-2 py-1.5 text-xs font-mono font-black text-amber-600 dark:text-amber-500 border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-[#0f172a] rounded outline-none focus:border-amber-500 text-right transition-colors" value="${valorParcelaBase.toLocaleString('pt-BR', {minimumFractionDigits: 2})}" oninput="window.mascaraValorItem(this); window.validarSomaParcelas()">
                    </div>
                </td>
                <td class="p-2">
                    <input type="text" class="input-doc-parcela w-full px-2 py-1.5 text-xs font-mono font-bold border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-[#0f172a] dark:text-white rounded outline-none focus:border-amber-500 transition-colors" placeholder="NSU/Doc (Opcional)">
                </td>
            </tr>
        `;
        dataAtual.setMonth(dataAtual.getMonth() + 1);
    }

    html += `
        <tr class="bg-gray-50 dark:bg-[#0f172a]">
            <td colspan="3" class="p-2 text-right text-xs font-bold text-gray-500 uppercase">Soma das Parcelas:</td>
            <td class="p-2 text-right font-mono font-black text-[#1a428a] dark:text-blue-400" id="soma-parcelas-footer">R$ ${restante.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
            <td></td>
        </tr>
    `;
    
    tbody.innerHTML = html;
    window.validarSomaParcelas();
};

window.validarSomaParcelas = function() {
    const elRestante = document.getElementById('fechamento-restante');
    const footerSoma = document.getElementById('soma-parcelas-footer');
    if(!elRestante || !footerSoma) return;

    const restante = parseFloat(elRestante.innerText.replace('R$ ', '').replace(/\./g, '').replace(',', '.')) || 0;
    
    let soma = 0;
    document.querySelectorAll('.input-val-parcela').forEach(input => {
        soma += parseFloat(input.value.replace(/\./g, '').replace(',', '.')) || 0;
    });

    footerSoma.innerText = 'R$ ' + soma.toLocaleString('pt-BR', {minimumFractionDigits: 2});

    const btnConfirmar = document.querySelector('button[onclick="window.confirmarFechamentoOS()"]');
    const diff = Math.abs(restante - soma);

    if (diff > 0.05) {
        footerSoma.classList.remove('text-[#1a428a]', 'dark:text-blue-400');
        footerSoma.classList.add('text-red-600', 'dark:text-red-400');
        if (btnConfirmar) {
            btnConfirmar.disabled = true;
            btnConfirmar.classList.replace('bg-amber-500', 'bg-gray-400');
            btnConfirmar.classList.replace('hover:bg-amber-600', 'hover:bg-gray-500');
            btnConfirmar.innerText = "VALORES NÃO BATEM";
        }
    } else {
        footerSoma.classList.add('text-[#1a428a]', 'dark:text-blue-400');
        footerSoma.classList.remove('text-red-600', 'dark:text-red-400');
        if (btnConfirmar) {
            btnConfirmar.disabled = false;
            btnConfirmar.classList.replace('bg-gray-400', 'bg-amber-500');
            btnConfirmar.classList.replace('hover:bg-gray-500', 'hover:bg-amber-600');
            btnConfirmar.innerText = "CONFIRMAR FECHAMENTO";
        }
    }
};

window.calcularGarantia = function() {
    const elEntrega = document.getElementById('fechamento-entrega');
    const inputDias = document.getElementById('fechamento-garantia-dias');
    const elGarantia = document.getElementById('fechamento-garantia');
    
    if(!elEntrega || !elGarantia) return;

    const entrega = elEntrega.value;
    const dias = inputDias ? (parseInt(inputDias.value) || 0) : 90;
    
    if(entrega) {
        const dataGarantia = new Date(entrega);
        dataGarantia.setMinutes(dataGarantia.getMinutes() + dataGarantia.getTimezoneOffset());
        dataGarantia.setDate(dataGarantia.getDate() + dias);
        elGarantia.value = dataGarantia.toISOString().split('T')[0];
    }
};

window.confirmarFechamentoOS = async function() {
    const elRestante = document.getElementById('fechamento-restante');
    if (!elRestante) return;
    const restante = parseFloat(elRestante.innerText.replace('R$ ', '').replace(/\./g, '').replace(',', '.')) || 0;
    
    let somaParcelas = 0;
    document.querySelectorAll('.input-val-parcela').forEach(input => {
        somaParcelas += parseFloat(input.value.replace(/\./g, '').replace(',', '.')) || 0;
    });
    
    if (Math.abs(restante - somaParcelas) > 0.05) {
        if(window.mostrarToast) window.mostrarToast("A soma das parcelas está incorreta!", "erro");
        return;
    }

    const confirmou = await window.abrirConfirmacao("Concluir O.S.", "Confirmar o fechamento definitivo e a geração do faturamento automático?", "aviso");
    if(!confirmou) return;
    
    try {
        const elConclusao = document.getElementById('fechamento-conclusao');
        const dataConclusao = elConclusao ? elConclusao.value : null;
        const novaSituacao = 'Fechado';

        const { error: errOS } = await supabase.from('ordens_servico').update({
            situacao: novaSituacao,
            status: novaSituacao,
            data_conclusao: dataConclusao
        }).eq('id', window.osEmEdicaoId);
        
        if (errOS) throw errOS;

        const clienteNome = document.getElementById('cliente')?.value || 'CLIENTE AVULSO';
        const veiculoPlaca = document.getElementById('placa')?.value || 'AVULSA';
        const contaDestinoGlobal = document.getElementById('fechamento-conta')?.value || 'Caixa Interno';
        const checkboxGerarFinanceiro = document.getElementById('fechamento-gerar-financeiro')?.checked;

        if (checkboxGerarFinanceiro !== false && restante > 0) {
            const linhasParcelas = document.querySelectorAll('#tbody-preview-parcelas .text-row-parcela');
            const loteFinanceiro = [];

            linhasParcelas.forEach(linha => {
                const indexTxt = linha.querySelector('.num-p-index').innerText; 
                const dataVenc = linha.querySelector('.input-data-parcela').value;
                const operacaoSel = linha.querySelector('.input-op-parcela').value;
                const valorRaw = linha.querySelector('.input-val-parcela').value;
                const nsuTxt = linha.querySelector('.input-doc-parcela').value || '';

                const valorNum = parseFloat(valorRaw.replace(/\./g, '').replace(',', '.')) || 0;

                if (valorNum > 0) {
                    loteFinanceiro.push({
                        os_id: window.osEmEdicaoId,
                        cliente: clienteNome.trim().toUpperCase(),
                        placa: veiculoPlaca.trim().toUpperCase(),
                        numero_parcela: indexTxt,
                        vencimento: dataVenc,
                        valor: valorNum,
                        operacao: operacaoSel,
                        conta_destino: contaDestinoGlobal,
                        nsu_doc: nsuTxt.trim().toUpperCase(),
                        status: 'Pendente'
                    });
                }
            });

            if (loteFinanceiro.length > 0) {
                const { error: errFin } = await supabase.from('contas_receber').insert(loteFinanceiro);
                if (errFin) throw errFin;
                console.log(`🟢 Ponte Financeira Executada: ${loteFinanceiro.length} parcelas salvas no cofre!`);
            }
        }

        if(window.mostrarToast) window.mostrarToast("O.S. Fechada e Financeiro Gerado!", "sucesso");
        const modalFech = document.getElementById('modal-fechamento-os');
        if(modalFech) modalFech.classList.add('hidden');
        window.fecharModalOsDireto();
        window.carregarOrdensServico();
    } catch(e) {
        console.error("FALHA DE ESCRITA NA PONTE FINANCEIRA:", e);
        alert("Erro crítico no faturamento: " + e.message);
    }
};

window.preencherVeiculoAvulso = function() {
    const setVal = (id, val) => { const el = document.getElementById(id); if(el){ el.value = val; el.dispatchEvent(new Event('input')); } };
    setVal('placa', 'AVULSA');
    setVal('modelo', 'VENDA BALCÃO / AVULSA');
    setVal('marca', 'N/A');
    setVal('ano', new Date().getFullYear());
    if(window.mostrarToast) window.mostrarToast("Modo O.S. Avulsa ativado!", "info");
};
