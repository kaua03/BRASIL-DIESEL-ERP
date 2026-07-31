// JS/modules/veiculo.js
import { supabase } from './config.js';

window.dadosVeiculosGerais = [];
window.listaClientesVei = []; 
window.vigilanciaVeiculoAtiva = false; 

const removerAcentos = (str) => {
    if(!str) return '';
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
};

window.formatarPlacaParaBusca = function(placa) {
    if (!placa) return '';
    return String(placa).toUpperCase().replace(/[^A-Z0-9-]/g, '');
};

// 🔴 MÁSCARA LIMPA E MANUAL: Apenas formata o visual perfeitamente, sem chamar APIs externas.
window.mascaraPlacaVeiculo = function(input) {
    let p = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 7);
    
    if (p.length === 7) {
        // Se for o padrão antigo (3 letras, 4 números), coloca o hífen
        if (/^[A-Z]{3}[0-9]{4}$/.test(p)) {
            input.value = p.substring(0, 3) + '-' + p.substring(3, 7);
        } else {
            // Se for padrão Mercosul (ex: ABC1D23), deixa sem hífen
            input.value = p; 
        }
    } else {
        input.value = p;
    }
};

window.carregarDropdownClientesParaVeiculos = async function() {
    try {
        const { data, error } = await supabase.from('clientes').select('id, nome_razao').order('nome_razao');
        if (!error && data) {
            window.listaClientesVei = data;
            const dl = document.getElementById('lista-clientes-vei');
            if (dl) {
                dl.innerHTML = data.map(c => `<option value="${c.nome_razao}">`).join('');
            }
        }
    } catch (e) { console.error("Erro ao carregar lista de clientes no veiculo:", e); }
};

window.ativarVigilanciaVeiculo = function() {
    if (window.vigilanciaVeiculoAtiva) return;
    window.vigilanciaVeiculoAtiva = true;

    supabase.channel('vigilancia-veiculo')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'veiculos' }, payload => {
            if (document.getElementById('tabela-dados-veiculos')) {
                window.carregarVeiculos(true); 
            }
        }).subscribe();
};

window.carregarVeiculos = async function(isSilencioso = false) {
    const tbody = document.getElementById('tabela-dados-veiculos');
    if (!tbody) return;

    if (!isSilencioso) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center p-8 text-gray-400 font-bold italic">Sincronizando a garagem...</td></tr>';
    }

    window.ativarVigilanciaVeiculo(); 
    window.carregarDropdownClientesParaVeiculos();

    try {
        const { data, error } = await supabase
            .from('veiculos')
            .select('*, clientes(nome_razao)')
            .order('id', { ascending: false });

        if (error) throw error;
        
        window.dadosVeiculosGerais = data || [];
        window.renderizarVeiculos();

    } catch (err) {
        console.error("ERRO AO CARREGAR VEICULOS:", err);
        if (!isSilencioso) tbody.innerHTML = '<tr><td colspan="5" class="text-center p-8 text-red-500 font-bold">Erro de conexão com o banco.</td></tr>';
    }
};

window.renderizarVeiculos = function() {
    const tbody = document.getElementById('tabela-dados-veiculos');
    if (!tbody) return;

    const textoBuscaBruto = (document.getElementById('filtro-busca-veiculo')?.value || '').trim();
    const textoBusca = removerAcentos(textoBuscaBruto);

    let totalAvulsos = 0;

    window.dadosVeiculosGerais.forEach(v => {
        if (!v.cliente_id) totalAvulsos++;
    });

    const elTotal = document.getElementById('card-vei-total');
    const elAvulsos = document.getElementById('card-vei-avulsos');
    if(elTotal) elTotal.innerText = window.dadosVeiculosGerais.length;
    if(elAvulsos) elAvulsos.innerText = totalAvulsos;

    let dadosFiltrados = window.dadosVeiculosGerais.filter(v => {
        if (!textoBusca) return true;
        
        const placa = removerAcentos(String(v.placa || ''));
        const modelo = removerAcentos(String(v.modelo || ''));
        const marca = removerAcentos(String(v.marca || ''));
        const clienteNome = v.clientes ? removerAcentos(String(v.clientes.nome_razao || '')) : '';
        
        return placa.includes(textoBusca) || modelo.includes(textoBusca) || marca.includes(textoBusca) || clienteNome.includes(textoBusca);
    });

    if (dadosFiltrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center p-8 text-gray-400 font-bold italic">Nenhum veículo encontrado com este filtro.</td></tr>`;
        return;
    }

    tbody.innerHTML = dadosFiltrados.map(v => {
        const placaFmt = window.formatarPlacaParaBusca(v.placa);
        const modeloFmt = `${String(v.marca || '---').toUpperCase()} / ${String(v.modelo || '---').toUpperCase()}`;
        const anoFmt = String(v.ano || '---');
        const clienteFmt = v.clientes && v.clientes.nome_razao ? String(v.clientes.nome_razao).toUpperCase() : 'VEÍCULO AVULSO (SEM DONO)';
        const cliCor = v.cliente_id ? 'text-gray-800 dark:text-white' : 'text-amber-500 font-bold';

        return `
            <tr class="border-b border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-[#0f172a] transition-all duration-150">
                <td class="p-4 text-center font-mono font-bold text-gray-400 text-xs border-r border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-[#0f172a]/50">
                    ${v.id}
                </td>
                <td class="p-4 text-center">
                    <span class="inline-block px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded font-mono font-black text-[#1a428a] dark:text-blue-400 text-sm tracking-widest border border-gray-300 dark:border-gray-600 shadow-sm">${placaFmt}</span>
                </td>
                <td class="p-4">
                    <span class="block font-black text-gray-800 dark:text-white uppercase truncate max-w-[250px]">${modeloFmt}</span>
                    <span class="block text-[10px] font-bold text-gray-500 mt-1 uppercase">ANO: ${anoFmt} | COR: ${v.cor || 'N/A'}</span>
                </td>
                <td class="p-4">
                    <span class="block text-xs uppercase truncate max-w-[250px] ${cliCor}">${clienteFmt}</span>
                </td>
                <td class="p-4 text-center">
                    <div class="flex items-center justify-center gap-1.5">
                        <button onclick="window.abrirPerfilCrmVeiculo('${v.placa}', '${modeloFmt}', '${clienteFmt}')" class="w-8 h-8 flex items-center justify-center bg-[#1a428a] hover:bg-blue-800 text-white rounded transition-all duration-150 shadow" title="Raio-X (Histórico Médico)">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                        </button>
                        <button onclick="window.abrirModalEditarVeiculo(${v.id})" class="w-8 h-8 flex items-center justify-center bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/30 dark:hover:bg-amber-800/50 text-amber-600 dark:text-amber-400 rounded transition-all duration-150" title="Editar Ficha">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button onclick="window.excluirVeiculo(${v.id}, this)" class="w-8 h-8 flex items-center justify-center bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-800/50 text-red-600 dark:text-red-400 rounded transition-all duration-150" title="Apagar Veículo">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
};

window.abrirModalVeiculo = function() {
    const form = document.getElementById('form-veiculo');
    if (form) form.reset();
    
    document.getElementById('vei-id').value = '';
    document.getElementById('titulo-modal-veiculo').innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg> Cadastrar Veículo
    `;
    
    document.getElementById('modal-veiculo').classList.remove('hidden');
    document.getElementById('modal-veiculo').classList.add('flex');
};

window.abrirModalEditarVeiculo = function(id) {
    const v = window.dadosVeiculosGerais.find(c => c.id === id);
    if (!v) return;

    document.getElementById('vei-id').value = v.id;
    
    const inputP = document.getElementById('vei-placa');
    inputP.value = v.placa || '';
    window.mascaraPlacaVeiculo(inputP); // Apenas aplica a máscara visual
    
    document.getElementById('vei-uf').value = v.uf || ''; 
    document.getElementById('vei-marca').value = v.marca || '';
    document.getElementById('vei-modelo').value = v.modelo || '';
    document.getElementById('vei-ano').value = v.ano || '';
    document.getElementById('vei-cor').value = v.cor || '';
    document.getElementById('vei-motorizacao').value = v.motorizacao || '';
    document.getElementById('vei-obs').value = v.observacoes || '';
    
    if (v.clientes && v.clientes.nome_razao) {
        document.getElementById('vei-cliente').value = v.clientes.nome_razao;
    } else {
        document.getElementById('vei-cliente').value = '';
    }

    document.getElementById('titulo-modal-veiculo').innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg> Editar Ficha do Veículo
    `;

    document.getElementById('modal-veiculo').classList.remove('hidden');
    document.getElementById('modal-veiculo').classList.add('flex');
};

window.salvarVeiculo = async function(event) {
    event.preventDefault();

    const getVal = (id) => document.getElementById(id)?.value || '';
    const id = getVal('vei-id');
    const placaBruta = getVal('vei-placa');
    
    const placaLimpa = placaBruta.replace(/[^A-Za-z0-9-]/g, '').toUpperCase();
    if (placaLimpa.length < 7) {
        if(window.mostrarToast) window.mostrarToast("Placa inválida!", "erro");
        document.getElementById('vei-placa').focus(); return;
    }

    const clienteDigitado = getVal('vei-cliente').trim().toUpperCase();
    let clienteIdEncontrado = null;
    if (clienteDigitado) {
        const achou = window.listaClientesVei.find(c => c.nome_razao === clienteDigitado);
        if (achou) {
            clienteIdEncontrado = achou.id;
        } else {
            if(window.mostrarToast) window.mostrarToast("Cliente não encontrado. Veículo salvo como Avulso.", "aviso");
        }
    }

    let query = supabase.from('veiculos').select('id').eq('placa', placaLimpa);
    if (id) query = query.neq('id', id);
    
    const { data: duplicados } = await query;
    if (duplicados && duplicados.length > 0) {
        if (window.mostrarToast) window.mostrarToast("Erro: Esta placa já está na garagem!", "erro");
        document.getElementById('vei-placa').focus();
        return; 
    }

    const payload = {
        placa: placaLimpa,
        uf: getVal('vei-uf').trim().toUpperCase(),
        marca: getVal('vei-marca').trim().toUpperCase(),
        modelo: getVal('vei-modelo').trim().toUpperCase(),
        ano: getVal('vei-ano').trim(),
        cor: getVal('vei-cor').trim().toUpperCase(),
        motorizacao: getVal('vei-motorizacao').trim().toUpperCase(),
        observacoes: getVal('vei-obs').trim().toUpperCase(),
        cliente_id: clienteIdEncontrado
    };

    if (window.mostrarToast) window.mostrarToast("A salvar veículo na garagem...", "info");

    try {
        if (id) {
            const { error } = await supabase.from('veiculos').update(payload).eq('id', id);
            if (error) throw error;
            if (window.mostrarToast) window.mostrarToast("Veículo atualizado!", "sucesso");
        } else {
            const { error } = await supabase.from('veiculos').insert([payload]);
            if (error) throw error;
            if (window.mostrarToast) window.mostrarToast("Novo veículo na garagem!", "sucesso");
        }
        
        document.getElementById('modal-veiculo').classList.add('hidden');
        document.getElementById('modal-veiculo').classList.remove('flex');
        
        setTimeout(() => window.carregarVeiculos(true), 600);
    } catch (err) {
        console.error("ERRO AO SALVAR VEÍCULO:", err);
        if (window.mostrarToast) window.mostrarToast("Erro ao gravar placa no cofre.", "erro");
    }

    if(window.registrarLog) {
        const acao = idVeiculo ? 'Editou Veículo' : 'Cadastrou Veículo';
        const placaVei = document.getElementById('veiculo-placa').value.toUpperCase();
    window.registrarLog('Veículos', acao, `Placa: ${placaVei}`);
    }
};

window.excluirVeiculo = async function(id, btnElement) {
    const confirmou = await window.abrirConfirmacao("Excluir Veículo", "Atenção: Apagar o registro deste veículo da garagem?", "perigo");
    if (!confirmou) return;

    if (btnElement) {
        btnElement.innerHTML = `<svg class="animate-spin h-4 w-4 text-red-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
        const tr = btnElement.closest('tr');
        if (tr) tr.classList.add('bg-red-50', 'dark:bg-red-900/20', 'opacity-50');
    }

    try {
        const { error } = await supabase.from('veiculos').delete().eq('id', id);
        if (error) throw error;
        
        if (window.mostrarToast) window.mostrarToast("Veículo removido da garagem!", "sucesso");
        setTimeout(() => window.carregarVeiculos(true), 600);
    } catch (err) {
        console.error("ERRO AO EXCLUIR VEÍCULO:", err);
        if (window.mostrarToast) window.mostrarToast("Falha. Veículo pode estar atrelado a algo.", "erro");
        window.carregarVeiculos(true);
    }

    if(window.registrarLog) window.registrarLog('Veículos', 'Excluiu Veículo', `ID Removido: ${id}`);
};

window.abrirPerfilCrmVeiculo = async function(placaBusca, modeloStr, clienteStr) {
    document.getElementById('vei-perfil-placa').innerText = window.formatarPlacaParaBusca(placaBusca);
    document.getElementById('vei-perfil-modelo').innerText = modeloStr;
    document.getElementById('vei-perfil-dono').innerText = `Guardião: ${clienteStr}`;

    document.getElementById('vei-perfil-gasto').innerText = 'Calculando...';
    document.getElementById('vei-perfil-total-os').innerText = '0';
    document.getElementById('vei-perfil-ultima').innerText = 'Buscando...';
    document.getElementById('vei-perfil-lista-os').innerHTML = '<li class="p-4 text-center text-xs font-bold text-gray-400">Consultando ficha médica do carro...</li>';

    document.getElementById('modal-perfil-veiculo').classList.remove('hidden');
    document.getElementById('modal-perfil-veiculo').classList.add('flex');

    try {
        const placaLimpaBusca = placaBusca.replace(/[^A-Za-z0-9]/g, '');

        const { data: osData, error: osError } = await supabase
            .from('ordens_servico')
            .select('numero_os, total_geral, data_hora, situacao, cliente')
            .ilike('veiculo_placa', `%${placaLimpaBusca}%`) 
            .order('id', { ascending: false });

        if (!osError && osData && osData.length > 0) {
            const totalOs = osData.length;
            let custoTotal = 0;
            
            osData.forEach(os => custoTotal += Number(os.total_geral || 0));

            document.getElementById('vei-perfil-total-os').innerText = totalOs;
            document.getElementById('vei-perfil-gasto').innerText = `R$ ${custoTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
            
            if (osData[0].data_hora) {
                const ultima = new Date(osData[0].data_hora);
                document.getElementById('vei-perfil-ultima').innerText = ultima.toLocaleDateString('pt-BR');
            } else {
                document.getElementById('vei-perfil-ultima').innerText = "---";
            }

            document.getElementById('vei-perfil-lista-os').innerHTML = osData.map(os => {
                const dataOs = os.data_hora ? new Date(os.data_hora).toLocaleDateString('pt-BR') : '---';
                const valFmt = Number(os.total_geral || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2});
                const donoNaEpoca = String(os.cliente || 'AVULSO').toUpperCase();
                
                return `
                    <li class="p-3 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                        <div>
                            <span class="block font-black text-[#1a428a] dark:text-blue-400 text-xs uppercase">O.S. #${String(os.numero_os).padStart(4, '0')} <span class="text-gray-500 font-medium ml-1">(${os.situacao})</span></span>
                            <span class="block text-[9px] text-gray-500 font-bold uppercase mt-0.5">Dono na época: ${donoNaEpoca} | Data: ${dataOs}</span>
                        </div>
                        <span class="font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm">R$ ${valFmt}</span>
                    </li>
                `;
            }).join('');

        } else {
            document.getElementById('vei-perfil-gasto').innerText = "R$ 0,00";
            document.getElementById('vei-perfil-ultima').innerText = "---";
            document.getElementById('vei-perfil-lista-os').innerHTML = '<li class="p-4 text-center text-xs font-bold text-gray-400">Este veículo ainda não possui histórico de O.S.</li>';
        }

    } catch(e) {
        console.error("ERRO NO HISTÓRICO DO VEÍCULO:", e);
    }
};
