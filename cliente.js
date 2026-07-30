// JS/modules/cliente.js
import { supabase } from './config.js';

window.dadosClientesGerais = [];
window.filtroClienteAtual = 'TODOS'; 
window.vigilanciaClienteAtiva = false; 

const removerAcentos = (str) => {
    if(!str) return '';
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
};

window.mascaraDoc = function(input, fromUserInput = true) {
    let v = input.value.replace(/\D/g, ""); 
    const isPj = document.querySelector('input[name="cli-tipo"][value="Jurídica"]').checked;

    if (!isPj) { 
        v = v.substring(0, 11); 
        v = v.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
        input.value = v;
    } else { 
    
        v = v.substring(0, 14); 
        v = v.replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2");
        input.value = v;

        const limpo = v.replace(/\D/g, "");
        if (fromUserInput && limpo.length === 14) {
            window.buscarCnpjNaReceita(limpo);
        }
    }
};

window.mascaraTelefone = function(input) {
    let v = input.value.replace(/\D/g, "");
    if (v.length > 10) { 
        v = v.replace(/^(\d{2})(\d)/g, "($1) $2");
        v = v.replace(/(\d{5})(\d)/, "$1-$2");
    } else { 
        v = v.replace(/^(\d{2})(\d)/g, "($1) $2");
        v = v.replace(/(\d{4})(\d)/, "$1-$2");
    }
    input.value = v.substring(0, 15);
};

window.mascaraCep = function(input) {
    if(!input) return;
    let v = input.value.replace(/\D/g, "").substring(0, 8);
    v = v.replace(/^(\d{5})(\d)/, "$1-$2");
    input.value = v;
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

window.buscarCnpjNaReceita = async function(cnpjLimpo) {
    const loading = document.getElementById('loading-receita');
    if(loading) { loading.classList.remove('hidden'); loading.classList.add('flex'); }

    if(window.mostrarToast) window.mostrarToast("Consultando Receita Federal...", "sucesso");

    try {
        const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`);
        if (!response.ok) throw new Error("CNPJ não encontrado");

        const data = await response.json();
        
        document.getElementById('cli-nome').value = data.razao_social || data.nome_fantasia || '';
        document.getElementById('cli-email').value = data.email || '';
        
        if (data.ddd_telefone_1) {
            const telInput = document.getElementById('cli-telefone');
            telInput.value = data.ddd_telefone_1;
            window.mascaraTelefone(telInput);
        }

        if (data.cep) {
            const cepInput = document.getElementById('cli-cep');
            cepInput.value = String(data.cep).replace(/\D/g, '').replace(/^(\d{5})(\d{3})$/, "$1-$2");
            window.consultarCep(cepInput, 'cli-'); 
        }
        
        if(data.numero) document.getElementById('cli-numero_end').value = data.numero;
        if(data.complemento) document.getElementById('cli-complemento').value = data.complemento;

        if(window.mostrarToast) window.mostrarToast("Ficha preenchida pela Receita!", "sucesso");

    } catch (error) {
        console.error("ERRO BRASILAPI:", error);
        if(window.mostrarToast) window.mostrarToast("CNPJ não encontrado ou offline.", "aviso");
    } finally {
        if(loading) { loading.classList.add('hidden'); loading.classList.remove('flex'); }
    }
};

window.ativarVigilanciaCliente = function() {
    if (window.vigilanciaClienteAtiva) return;
    window.vigilanciaClienteAtiva = true;

    supabase.channel('vigilancia-cliente')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'clientes' }, payload => {
            const tbody = document.getElementById('tabela-dados-clientes');
            if (tbody) {
                console.log('📡 [Central] Alteração de Clientes detectada! Atualizando...');
                window.carregarClientes(true); 
            }
        })
        .subscribe();
};

window.carregarClientes = async function(isSilencioso = false) {
    const tbody = document.getElementById('tabela-dados-clientes');
    if (!tbody) return;

    if (!isSilencioso) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center p-8 text-gray-400 font-bold italic">Buscando registros na central...</td></tr>';
    }

    window.ativarVigilanciaCliente(); 

    try {
        const { data, error } = await supabase
            .from('clientes')
            .select('*')
            .order('nome_razao', { ascending: true });

        if (error) throw error;
        
        window.dadosClientesGerais = data || [];
        window.renderizarClientes();

    } catch (err) {
        console.error("ERRO AO CARREGAR CLIENTES:", err);
        if (!isSilencioso) tbody.innerHTML = '<tr><td colspan="6" class="text-center p-8 text-red-500 font-bold">Erro de conexão com o banco de clientes.</td></tr>';
    }
};

window.mudarFiltroCliente = function(status) {
    window.filtroClienteAtual = status;
    const btnTodos = document.getElementById('btn-tab-cli-todos');
    const btnPf = document.getElementById('btn-tab-cli-pf');
    const btnPj = document.getElementById('btn-tab-cli-pj');
    const classeAtiva = "flex-1 sm:flex-initial px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-150 bg-[#1a428a] text-white shadow-sm";
    const classeInativa = "flex-1 sm:flex-initial px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-150 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white bg-transparent";

    if(btnTodos) btnTodos.className = status === 'TODOS' ? classeAtiva : classeInativa;
    if(btnPf) btnPf.className = status === 'Física' ? classeAtiva : classeInativa;
    if(btnPj) btnPj.className = status === 'Jurídica' ? classeAtiva : classeInativa;
    
    window.renderizarClientes();
};

window.renderizarClientes = function() {
    const tbody = document.getElementById('tabela-dados-clientes');
    if (!tbody) return;

    const textoBuscaBruto = (document.getElementById('filtro-busca-cliente')?.value || '').trim();
    const textoBusca = removerAcentos(textoBuscaBruto);

    let totalPf = 0;
    let totalPj = 0;

    window.dadosClientesGerais.forEach(cli => {
        if (cli.tipo_cliente === 'Física') totalPf++;
        if (cli.tipo_cliente === 'Jurídica') totalPj++;
    });

    const elPf = document.getElementById('card-clientes-pf');
    const elPj = document.getElementById('card-clientes-pj');
    if(elPf) elPf.innerText = totalPf;
    if(elPj) elPj.innerText = totalPj;

    let dadosFiltrados = window.dadosClientesGerais.filter(cli => {
        const bateAba = window.filtroClienteAtual === 'TODOS' || cli.tipo_cliente === window.filtroClienteAtual;
        
        let bateTexto = true;
        if (textoBusca) {
            const nome = removerAcentos(String(cli.nome_razao || ''));
            const doc = removerAcentos(String(cli.cpf_cnpj || ''));
            const tel = removerAcentos(String(cli.telefone || ''));
            
            bateTexto = nome.includes(textoBusca) || doc.includes(textoBusca) || tel.includes(textoBusca);
        }
        return bateAba && bateTexto;
    });

    if (dadosFiltrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center p-8 text-gray-400 font-bold italic">Nenhum cliente encontrado com este filtro.</td></tr>`;
        return;
    }

    tbody.innerHTML = dadosFiltrados.map(cli => {
        const nomeFmt = String(cli.nome_razao || '---').toUpperCase();
        const docFmt = String(cli.cpf_cnpj || '---');
        const telFmt = String(cli.telefone || '---');
        const emailFmt = String(cli.email || '').toLowerCase();
        
        const badgeCor = cli.tipo_cliente === 'Física' 
            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' 
            : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400';

        const btnCrm = `
            <button onclick="window.abrirPerfilCrmCliente(${cli.id})" class="w-8 h-8 flex items-center justify-center bg-[#1a428a] hover:bg-blue-800 text-white rounded transition-all duration-150 shadow" title="Raio-X do Cliente (CRM)">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" /></svg>
            </button>
        `;

        const btnEditar = `
            <button onclick="window.abrirModalEditarCliente(${cli.id})" class="w-8 h-8 flex items-center justify-center bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/30 dark:hover:bg-amber-800/50 text-amber-600 dark:text-amber-400 rounded transition-all duration-150" title="Editar Ficha">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
            </button>
        `;

        const btnExcluir = `
            <button onclick="window.excluirCliente(${cli.id}, this)" class="w-8 h-8 flex items-center justify-center bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-800/50 text-red-600 dark:text-red-400 rounded transition-all duration-150" title="Apagar Cliente">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
        `;

        return `
            <tr class="border-b border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-[#0f172a] transition-all duration-150">
                <td class="p-4 text-center font-mono font-bold text-gray-400 text-xs border-r border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-[#0f172a]/50">
                    ${cli.id}
                </td>
                <td class="p-4">
                    <span class="block font-black text-gray-800 dark:text-white uppercase truncate max-w-[300px]" title="${nomeFmt}">${nomeFmt}</span>
                    <span class="block text-[10px] font-bold text-gray-400 mt-1 uppercase truncate max-w-[300px]">${cli.endereco || 'ENDEREÇO NÃO CADASTRADO'}</span>
                </td>
                <td class="p-4 text-center font-mono font-bold text-[#1a428a] dark:text-blue-400 text-sm tracking-widest">${docFmt}</td>
                <td class="p-4 text-center">
                    <span class="block font-mono font-bold text-gray-700 dark:text-gray-300 text-xs">${telFmt}</span>
                    <span class="block text-[10px] text-gray-500 mt-1">${emailFmt || 'SEM EMAIL'}</span>
                </td>
                <td class="p-4 text-center">
                    <span class="inline-block px-2 py-1 rounded text-[10px] font-black tracking-wider uppercase ${badgeCor}">${cli.tipo_cliente}</span>
                </td>
                <td class="p-4 text-center">
                    <div class="flex items-center justify-center gap-1.5">
                        ${btnCrm}
                        ${btnEditar}
                        ${btnExcluir}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
};

// 🔴 O NOVO CÉREBRO DO CRM (CORRIGIDO PARA IGNORAR ERROS DE DIGITAÇÃO) 🔴
window.abrirPerfilCrmCliente = async function(id) {
    const cli = window.dadosClientesGerais.find(c => c.id === id);
    if (!cli) return;

    document.getElementById('crm-nome').innerText = cli.nome_razao || 'DESCONHECIDO';
    document.getElementById('crm-doc').innerText = cli.cpf_cnpj || 'S/ DOCUMENTO';
    document.getElementById('crm-tipo').innerText = cli.tipo_cliente;

    document.getElementById('crm-ltv').innerText = 'Calculando...';
    document.getElementById('crm-ticket').innerText = '---';
    document.getElementById('crm-total-os').innerText = '0';
    document.getElementById('crm-ultima-visita').innerText = 'Buscando...';
    
    document.getElementById('crm-lista-veiculos').innerHTML = '<li class="p-4 text-center text-xs font-bold text-gray-400">Consultando frota...</li>';
    document.getElementById('crm-lista-os').innerHTML = '<li class="p-4 text-center text-xs font-bold text-gray-400">Consultando histórico...</li>';

    document.getElementById('modal-perfil-cliente').classList.remove('hidden');
    document.getElementById('modal-perfil-cliente').classList.add('flex');

    try {
        const nomeParaBusca = String(cli.nome_razao).trim();
        
        // Usa ilike para não falhar por causa de espaços extras ou minúsculas/maiúsculas, e usa a data_hora correta da OS
        const { data: osData, error: osError } = await supabase
            .from('ordens_servico')
            .select('numero_os, total_geral, data_hora, situacao, placa, marca, modelo, ano')
            .ilike('cliente', `%${nomeParaBusca}%`)
            .order('id', { ascending: false });

        if (!osError && osData && osData.length > 0) {
            const totalOs = osData.length;
            let ltv = 0;
            
            osData.forEach(os => ltv += Number(os.total_geral || 0));
            
            const ticketMedio = totalOs > 0 ? (ltv / totalOs) : 0;

            document.getElementById('crm-total-os').innerText = totalOs;
            document.getElementById('crm-ltv').innerText = `R$ ${ltv.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
            document.getElementById('crm-ticket').innerText = `R$ ${ticketMedio.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
            
            // Corrige a leitura da última visita usando a data da O.S. (data_hora)
            if (osData[0].data_hora) {
                const ultima = new Date(osData[0].data_hora);
                document.getElementById('crm-ultima-visita').innerText = ultima.toLocaleDateString('pt-BR');
            } else {
                document.getElementById('crm-ultima-visita').innerText = "---";
            }

            const ultimasDezOs = osData.slice(0, 10);
            document.getElementById('crm-lista-os').innerHTML = ultimasDezOs.map(os => {
                const dataOs = os.data_hora ? new Date(os.data_hora).toLocaleDateString('pt-BR') : '---';
                const valFmt = Number(os.total_geral || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2});
                return `
                    <li class="p-3 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                        <div>
                            <span class="block font-black text-gray-800 dark:text-white text-xs uppercase">O.S. #${String(os.numero_os).padStart(4, '0')}</span>
                            <span class="block text-[9px] text-gray-500 uppercase mt-0.5">${dataOs} | Status: ${os.situacao}</span>
                        </div>
                        <span class="font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm">R$ ${valFmt}</span>
                    </li>
                `;
            }).join('');

            // Extração Inteligente da Frota
            let frotaMap = new Map();
            osData.forEach(os => {
                if (os.placa && os.placa.trim().toUpperCase() !== 'AVULSA') {
                    if (!frotaMap.has(os.placa)) {
                        frotaMap.set(os.placa, { placa: os.placa, marca: os.marca, modelo: os.modelo, ano: os.ano });
                    }
                }
            });
            
            const frotaUnica = Array.from(frotaMap.values());
            
            if (frotaUnica.length > 0) {
                document.getElementById('crm-lista-veiculos').innerHTML = frotaUnica.map(v => `
                    <li class="p-3 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                        <div>
                            <span class="block font-black text-gray-800 dark:text-white text-xs uppercase">${v.marca || ''} ${v.modelo || 'VEÍCULO DESCONHECIDO'}</span>
                            <span class="block text-[9px] text-gray-500 uppercase mt-0.5">Ano: ${v.ano || '---'}</span>
                        </div>
                        <span class="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded font-mono font-black text-[#1a428a] dark:text-blue-400 text-xs tracking-widest">${window.formatarPlaca(v.placa)}</span>
                    </li>
                `).join('');
            } else {
                document.getElementById('crm-lista-veiculos').innerHTML = '<li class="p-4 text-center text-xs font-bold text-gray-400">Nenhum veículo registado nas O.S.</li>';
            }

        } else {
            // Se o cliente nunca fez uma O.S. (ou erro silenciado)
            document.getElementById('crm-ltv').innerText = "R$ 0,00";
            document.getElementById('crm-ticket').innerText = "R$ 0,00";
            document.getElementById('crm-ultima-visita').innerText = "---";
            document.getElementById('crm-lista-os').innerHTML = '<li class="p-4 text-center text-xs font-bold text-gray-400">Cliente ainda não abriu Ordens de Serviço.</li>';
            document.getElementById('crm-lista-veiculos').innerHTML = '<li class="p-4 text-center text-xs font-bold text-gray-400">Nenhum veículo registado.</li>';
        }

    } catch(e) {
        console.error("ERRO NO CRM:", e);
    }
};

window.trocarTipoClienteUI = function() {
    const isPj = document.querySelector('input[name="cli-tipo"][value="Jurídica"]').checked;
    const lblNome = document.getElementById('lbl-cli-nome');
    const lblDoc = document.getElementById('lbl-cli-doc');
    const inNome = document.getElementById('cli-nome');
    const inDoc = document.getElementById('cli-doc');

    if (isPj) {
        lblNome.innerText = "Razão Social / Nome Fantasia";
        lblDoc.innerText = "CNPJ";
        inNome.placeholder = "EMPRESA LTDA";
        inDoc.placeholder = "00.000.000/0000-00";
        inDoc.maxLength = 18; 
    } else {
        lblNome.innerText = "Nome Completo";
        lblDoc.innerText = "CPF";
        inNome.placeholder = "NOME DO CLIENTE";
        inDoc.placeholder = "000.000.000-00";
        inDoc.maxLength = 14; 
    }
    
    inDoc.value = ''; 
};

window.abrirModalCliente = function() {
    const form = document.getElementById('form-cliente');
    if (form) form.reset();
    
    document.getElementById('cli-id').value = '';
    document.getElementById('titulo-modal-cliente').innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
        Cadastrar Cliente
    `;
    
    document.querySelector('input[name="cli-tipo"][value="Física"]').checked = true;
    window.trocarTipoClienteUI();

    document.getElementById('modal-cliente').classList.remove('hidden');
    document.getElementById('modal-cliente').classList.add('flex');
};

window.abrirModalEditarCliente = function(id) {
    const cli = window.dadosClientesGerais.find(c => c.id === id);
    if (!cli) return;

    document.getElementById('cli-id').value = cli.id;
    
    document.querySelector(`input[name="cli-tipo"][value="${cli.tipo_cliente}"]`).checked = true;
    window.trocarTipoClienteUI();

    document.getElementById('cli-nome').value = cli.nome_razao || '';
    document.getElementById('cli-telefone').value = cli.telefone || '';
    document.getElementById('cli-email').value = cli.email || '';
    
    document.getElementById('cli-cep').value = cli.cep || '';
    document.getElementById('cli-endereco').value = cli.endereco || '';
    document.getElementById('cli-numero_end').value = cli.numero_end || '';
    document.getElementById('cli-bairro').value = cli.bairro || '';
    document.getElementById('cli-cidade').value = cli.cidade || '';
    document.getElementById('cli-complemento').value = cli.complemento || '';
    
    document.getElementById('cli-obs').value = cli.observacoes || '';
    
    const docInput = document.getElementById('cli-doc');
    docInput.value = cli.cpf_cnpj || '';
    window.mascaraDoc(docInput, false); 

    document.getElementById('titulo-modal-cliente').innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
        Editar Ficha do Cliente
    `;

    document.getElementById('modal-cliente').classList.remove('hidden');
    document.getElementById('modal-cliente').classList.add('flex');
};

window.salvarCliente = async function(event) {
    event.preventDefault();

    const getVal = (id) => document.getElementById(id)?.value || '';
    const id = getVal('cli-id');
    const isPj = document.querySelector('input[name="cli-tipo"][value="Jurídica"]').checked;
    const docFormatado = getVal('cli-doc').trim();

    if (docFormatado) {
        let query = supabase.from('clientes').select('id').eq('cpf_cnpj', docFormatado);
        if (id) {
            query = query.neq('id', id); 
        }
        const { data: duplicados, error: errBusca } = await query;
        if (duplicados && duplicados.length > 0) {
            if (window.mostrarToast) window.mostrarToast("Erro: Este CPF/CNPJ já está cadastrado!", "erro");
            document.getElementById('cli-doc').focus();
            return; 
        }
    }

    const payload = {
        tipo_cliente: isPj ? 'Jurídica' : 'Física',
        nome_razao: getVal('cli-nome').trim().toUpperCase(),
        cpf_cnpj: docFormatado,
        telefone: getVal('cli-telefone').trim(),
        email: getVal('cli-email').trim().toLowerCase(),
        
        cep: getVal('cli-cep').trim(),
        endereco: getVal('cli-endereco').trim().toUpperCase(),
        numero_end: getVal('cli-numero_end').trim(),
        bairro: getVal('cli-bairro').trim().toUpperCase(),
        cidade: getVal('cli-cidade').trim().toUpperCase(),
        complemento: getVal('cli-complemento').trim().toUpperCase(),
        
        observacoes: getVal('cli-obs').trim().toUpperCase()
    };

    if (window.mostrarToast) window.mostrarToast("Salvando ficha do cliente...", "info");

    try {
        if (id) {
            const { error } = await supabase.from('clientes').update(payload).eq('id', id);
            if (error) throw error;
            if (window.mostrarToast) window.mostrarToast("Ficha atualizada com sucesso!", "sucesso");
        } else {
            const { error } = await supabase.from('clientes').insert([payload]);
            if (error) throw error;
            if (window.mostrarToast) window.mostrarToast("Novo cliente cadastrado!", "sucesso");
        }
        
        document.getElementById('modal-cliente').classList.add('hidden');
        document.getElementById('modal-cliente').classList.remove('flex');
        
        setTimeout(() => window.carregarClientes(true), 600);
    } catch (err) {
        console.error("ERRO AO SALVAR CLIENTE:", err);
        if (window.mostrarToast) window.mostrarToast("Erro ao gravar ficha no cofre.", "erro");
    }
};

window.excluirCliente = async function(id, btnElement) {
    const confirmou = await window.abrirConfirmacao("Excluir Cliente", "Atenção: Apagar o registro do cliente? Esta ação não pode ser desfeita.", "perigo");
    if (!confirmou) return;

    if (btnElement) {
        btnElement.innerHTML = `<svg class="animate-spin h-4 w-4 text-red-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
        const tr = btnElement.closest('tr');
        if (tr) tr.classList.add('bg-red-50', 'dark:bg-red-900/20', 'opacity-50');
    }

    try {
        const { error } = await supabase.from('clientes').delete().eq('id', id);
        if (error) throw error;
        
        if (window.mostrarToast) window.mostrarToast("Registro eliminado!", "sucesso");
        setTimeout(() => window.carregarClientes(true), 600);
    } catch (err) {
        console.error("ERRO AO EXCLUIR CLIENTE:", err);
        if (window.mostrarToast) window.mostrarToast("Falha. Cliente pode estar atrelado a uma O.S.", "erro");
        window.carregarClientes(true);
    }
};

window.formatarPlaca = function(placa) {
    if (!placa) return '';
    let p = String(placa).toUpperCase().replace(/[^A-Z0-9-]/g, '');
    if (/^[A-Z]{3}[0-9]{4}$/.test(p)) return p.substring(0, 3) + '-' + p.substring(3, 7);
    return p;
};
