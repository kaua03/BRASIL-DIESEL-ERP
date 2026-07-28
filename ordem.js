// JS/modules/ordem.js
import { supabase } from './config.js';

window.itensOrcamento = [];
window.osEmEdicaoId = null;
window.osEmEdicaoNumero = null;
window.formAlterado = false;
window.modoLeitura = false;
window.itemEmEdicaoId = null;
window.listaVeiculosBdd = []; 

// =========================================================================
// 1. MÁSCARAS E APIS
// =========================================================================
window.formatarPlaca = function(placa) {
    if (!placa) return '';
    let p = String(placa).toUpperCase().replace(/[^A-Z0-9-]/g, '');
    if (/^[A-Z]{3}[0-9]{4}$/.test(p)) return p.substring(0, 3) + '-' + p.substring(3, 7);
    return p;
};

window.mascaraPlaca = function(input) {
    if(!input) return;
    let p = input.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
    input.value = p;
    if (typeof window.atualizarTituloModalOs === 'function') window.atualizarTituloModalOs(window.osNumeroAtual, input.value);
};

window.validarPlacaBrasil = function(placa) {
    if (!placa || String(placa).length < 3) return false;
    return true; 
};

window.mascaraCpfCnpj = function(input) {
    if(!input) return;
    let v = input.value.replace(/\D/g, "");
    if (v.length <= 11) v = v.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    else v = v.substring(0, 14).replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2");
    input.value = v;
};

window.mascaraCelular = function(input) {
    if(!input) return;
    let v = input.value.replace(/\D/g, "").substring(0, 11);
    v = v.replace(/^(\d{2})(\d)/g, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
    input.value = v;
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

window.consultarCnpj = async function(input) {
    if(!input) return;
    let doc = input.value.replace(/\D/g, '');
    if (doc.length === 14) {
        if (window.mostrarToast) window.mostrarToast("Consultando CNPJ...", "aviso");
        try {
            let res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${doc}`);
            if (res.ok) {
                let dados = await res.json();
                const setVal = (id, val) => { const el = document.getElementById(id); if(el) el.value = val; };
                
                setVal('cliente', String(dados.razao_social || dados.nome_fantasia || '').trim());
                if (dados.ddd_telefone_1) {
                    setVal('celular', dados.ddd_telefone_1);
                    window.mascaraCelular(document.getElementById('celular'));
                }
                if (dados.email && dados.email.trim() !== "") setVal('cliente_email', String(dados.email).toLowerCase().trim());
                if (dados.numero) setVal('numero_end', String(dados.numero).trim());
                if (dados.cep) {
                    setVal('cep', String(dados.cep).replace(/\D/g, '').replace(/^(\d{5})(\d{3})$/, "$1-$2"));
                    window.consultarCep(document.getElementById('cep'));
                }
                if (window.mostrarToast) window.mostrarToast("Dados do CNPJ preenchidos!", "sucesso");
            }
        } catch (e) { console.error(e); }
    }
};

window.consultarCep = async function(input) {
    if(!input) return;
    let cep = input.value.replace(/\D/g, '');
    if (cep.length === 8) {
        try {
            let res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            if (res.ok) {
                let dados = await res.json();
                if (!dados.erro) {
                    const setVal = (id, val) => { const el = document.getElementById(id); if(el) el.value = val; };
                    setVal('endereco', String(dados.logradouro || '').trim());
                    setVal('bairro', String(dados.bairro || '').trim());
                    setVal('cidade', `${String(dados.localidade || '').trim()} / ${String(dados.uf || '').trim()}`);
                    document.getElementById('numero_end')?.focus();
                }
            }
        } catch (e) { console.error(e); }
    }
};

// =========================================================================
// 2. CONEXÃO COM BDD E GATILHOS
// =========================================================================
window.carregarDatalists = async function() {
    try {
        const { data: clientes } = await supabase.from('clientes').select('nome, documento').order('nome');
        if (clientes) {
            const dlClientes = document.getElementById('lista-clientes');
            if (dlClientes) dlClientes.innerHTML = clientes.map(c => `<option value="${c.nome}">${c.documento || ''}</option>`).join('');
        }

        const { data: veiculos } = await supabase.from('veiculos').select('modelo, marca').order('modelo');
        if (veiculos) {
            window.listaVeiculosBdd = veiculos;
            const modelosUnicos = [...new Set(veiculos.map(v => v.modelo))];
            const dlVeiculos = document.getElementById('lista-veiculos');
            if (dlVeiculos) dlVeiculos.innerHTML = modelosUnicos.map(m => `<option value="${m}">`).join('');
        }
    } catch (e) { console.error("Erro ao carregar listas suspensas:", e); }
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
});

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

    if (ativo) {
        if (btnFecharOs) btnFecharOs.classList.add('hidden');
        if (btnBalcao) btnBalcao.classList.add('hidden'); 
        if (painelAdicionar) painelAdicionar.classList.add('hidden');
        if (painelEdicao) painelEdicao.classList.add('hidden');
        if (painelTopoResumo) painelTopoResumo.classList.remove('hidden');
        if (cabecalho) { cabecalho.classList.remove('bg-[#1a428a]'); cabecalho.classList.add('bg-gray-700'); }
    } else {
        if (btnFecharOs) btnFecharOs.classList.remove('hidden');
        if (btnBalcao) btnBalcao.classList.remove('hidden'); 
        if (painelAdicionar) painelAdicionar.classList.remove('hidden');
        if (painelEdicao) painelEdicao.classList.remove('hidden');
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

window.atualizarTopHeaderVisualizacao = function(os) {
    const hCliente = document.getElementById('header-view-cliente');
    const hVeiculo = document.getElementById('header-view-veiculo');
    const hPlaca = document.getElementById('header-view-placa');
    if(hCliente) hCliente.innerText = String(os.cliente || 'CLIENTE NÃO INFORMADO').toUpperCase();
    if(hVeiculo) hVeiculo.innerText = String(os.modelo || 'VEÍCULO NÃO INFORMADO').toUpperCase();
    if(hPlaca) hPlaca.innerText = window.formatarPlaca(os.placa);
};

// MOTOR ANTI-CORTE DO DROPDOWN
window.toggleDrop = function(id, btnElement) {
    document.querySelectorAll('.menu-acao-os').forEach(el => {
        if (el.id !== `menu-${id}`) el.classList.add('hidden');
    });

    const menu = document.getElementById(`menu-${id}`);
    if (!menu) return;

    if (menu.classList.contains('hidden')) {
        menu.classList.remove('hidden');
        
        const rect = btnElement.getBoundingClientRect();
        menu.style.position = 'fixed'; 
        menu.style.zIndex = '99999';
        
        const menuWidth = 192; 
        const menuHeight = menu.offsetHeight || 160;

        let topPos = rect.bottom + 4;
        if (topPos + menuHeight > window.innerHeight) {
            topPos = rect.top - menuHeight - 4;
        }

        let leftPos = rect.right - menuWidth; 
        if (leftPos < 0) leftPos = rect.left; 
        
        menu.style.top = `${topPos}px`;
        menu.style.left = `${leftPos}px`;
    } else {
        menu.classList.add('hidden');
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
    } catch (e) {
        console.error("ERRO AO ATUALIZAR STATUS:", e);
        if (window.mostrarToast) window.mostrarToast("Erro ao atualizar situação. Verifique o console.", "erro");
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

window.imprimirOsDaLista = async function(id) {
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
        if(window.mostrarToast) window.mostrarToast("Erro ao imprimir.", "erro");
    }
};

window.salvarComoPdfDaLista = async function(id) {
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
        if (window.mostrarToast) window.mostrarToast("Erro ao gerar PDF.", "erro"); 
    }
};

window.enviarWhatsAppDaLista = async function(id, celular) {
    const menu = document.getElementById(`menu-${id}`);
    if(menu) menu.classList.add('hidden');

    const telLimpo = String(celular || '').replace(/\D/g, '');
    if (telLimpo.length < 10) {
        if (window.mostrarToast) window.mostrarToast("Cliente sem WhatsApp válido!", "erro");
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

        const linkLaudoTexto = os.link_laudo ? `\n*Acesse também o Laudo Técnico e Evidências:* \n${os.link_laudo}\n` : '';

        const mensagem = `Olá, *${cliente}*!\n\nAqui é da *Brasil Diesel Performance*.\nSua Ordem de Serviço *#${osNum}* (Placa: ${window.formatarPlaca(os.placa)}) foi atualizada.\n\n*Situação Atual:* ${os.situacao || 'Aberto'}\n*Valor Total:* R$ ${calcTotalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n\n *Acesse seu Orçamento Detalhado em PDF aqui:* \n${linkPdf}\n${linkLaudoTexto}\nQualquer dúvida, estamos à disposição!`;
        
        const url = `https://wa.me/55${telLimpo}?text=${encodeURIComponent(mensagem)}`;
        window.open(url, '_blank');

    } catch (e) {
        console.error(e);
        if (window.mostrarToast) window.mostrarToast("Erro ao processar integração.", "erro");
    }
};

window.visualizarNotificacaoLab = async function(osId, osNum, placa, situacao) {
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
            } else if (window.mostrarToast) {
                window.mostrarToast("Navegue até a aba Laboratório para ver as atualizações.", "info");
            }
        }, 600);

    } catch (e) { 
        console.error(e); 
        if(window.mostrarToast) window.mostrarToast("Erro ao limpar aviso.", "erro");
    }
};

// =========================================================================
// 5. BANCO DE DADOS E TABELA PRINCIPAL
// =========================================================================
window.carregarOrdensServico = async function() {
    const tabela = document.getElementById('tabela-ordens-servico');
    if (!tabela) return;

    tabela.innerHTML = '<tr><td colspan="7" class="text-center p-8 text-gray-500 font-bold">A carregar base de dados...</td></tr>';
    window.carregarDatalists(); 

    try {
        const { data, error } = await supabase.from('ordens_servico').select('*, itens_orcamento(*)').order('id', { ascending: false });
        if (error) throw error;

        if (!data || data.length === 0) {
            tabela.innerHTML = '<tr><td colspan="7" class="text-center p-8 text-gray-400 font-bold italic">Nenhuma O.S. registada.</td></tr>';
            return;
        }

        tabela.innerHTML = data.map(os => {
            const numeroFormatado = String(os.numero_os || os.id).padStart(4, '0');
            const dataFormatada = os.data_hora ? new Date(os.data_hora).toLocaleString('pt-BR') : '---';
            const placaFormatada = window.formatarPlaca(os.placa);
            
            const clienteFormatado = String(os.cliente || '---').trim().toUpperCase();
            const modeloUpper = String(os.modelo || '---').trim().toUpperCase();
            const veiculoFormatado = os.ano ? `${modeloUpper} - ${os.ano}` : modeloUpper;
            
            const qtdItens = os.itens_orcamento ? os.itens_orcamento.reduce((soma, i) => soma + (Number(i.quantidade) || 1), 0) : 0;
            const tPecas = os.itens_orcamento ? os.itens_orcamento.filter(i => i.tipo === 'Peça').reduce((a, i) => a + (Number(i.subtotal) || 0), 0) : 0;
            const tServ = os.itens_orcamento ? os.itens_orcamento.filter(i => i.tipo === 'Serviço').reduce((a, i) => a + (Number(i.subtotal) || 0), 0) : 0;
            const totalMatematico = Math.max(0, tPecas + tServ + Number(os.outros_valores || 0) - Number(os.desconto || 0));
            
            let iconeNotificacao = os.lab_atualizado ? `<button type="button" onclick="window.visualizarNotificacaoLab(${os.id}, '${numeroFormatado}', '${os.placa}', '${os.situacao}')" class="absolute -left-6 text-red-500 hover:text-red-700 animate-pulse transition-all" title="Laboratório enviou atualizações!"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 drop-shadow-sm" viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" /></svg></button>` : '';

            const bgStatus = window.obterCoresStatus(os.situacao);

            return `
                <tr class="hover:bg-gray-50 dark:hover:bg-gray-800 transition-all border-b border-gray-100 dark:border-gray-700">
                    <td class="p-4 font-mono font-bold text-gray-500 dark:text-gray-400">#${numeroFormatado}</td>
                    <td class="p-4 text-xs font-mono text-gray-600 dark:text-gray-400">${dataFormatada}</td>
                    <td class="p-4 font-black text-[#1a428a] dark:text-blue-400 tracking-wider text-lg whitespace-nowrap text-center relative">${iconeNotificacao}<span>${placaFormatada}</span></td>
                    <td class="p-4 text-sm text-gray-700 dark:text-gray-300">
                        <p class="font-bold text-gray-800 dark:text-white">${clienteFormatado}</p>
                        <p class="text-xs text-gray-500 dark:text-gray-400 font-medium">${veiculoFormatado}</p>
                    </td>
                    <td class="p-4 text-right text-sm border-l border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-transparent">
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
                            <option value="Não Usar" style="background-color: #FEE2E2; color: #991B1B; font-weight: 800;" ${os.situacao === 'Não Usar' ? 'selected' : ''}>CANCELADA</option>
                            <option value="Recusado" style="background-color: #FECACA; color: #B91C1C; font-weight: 800;" ${os.situacao === 'Recusado' ? 'selected' : ''}>RECUSADO</option>
                        </select>
                    </td>
                    <td class="p-4">
                        <div class="flex items-center justify-center gap-2 relative dropdown-container">
                            <button type="button" onclick="window.visualizarOs(${os.id})" class="text-blue-500 hover:text-blue-700 bg-white hover:bg-blue-50 dark:bg-gray-800 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600 p-2 rounded-lg transition-all shadow-sm" title="Ver Detalhes">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                            </button>
                            <button type="button" onclick="window.editarOs(${os.id})" class="text-amber-500 hover:text-amber-700 bg-white hover:bg-amber-50 dark:bg-gray-800 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600 p-2 rounded-lg transition-all shadow-sm" title="Editar O.S">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </button>
                            <button type="button" onclick="window.excluirOs(${os.id}, '${os.placa}', '${numeroFormatado}')" class="text-red-500 hover:text-red-700 bg-white hover:bg-red-50 dark:bg-gray-800 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600 p-2 rounded-lg transition-all shadow-sm" title="Eliminar O.S">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>

                            <button type="button" onclick="window.toggleDrop(${os.id}, this)" class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 border border-transparent dark:border-gray-600 p-2 rounded-lg transition-all shadow-sm" title="Mais Opções">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" /></svg>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (err) { console.error("Erro ao listar O.S:", err); }
};

// =========================================================================
// 6. GESTÃO DO MODAL DE O.S. (BLINDAGEM E TRY/CATCH ALARMADOS)
// =========================================================================
window.abrirModalNovaOs = async function() {
    window.osEmEdicaoId = null; window.osNumeroAtual = null;
    window.itensOrcamento = []; window.modoLeitura = false; window.itemEmEdicaoId = null;
    document.getElementById('form-nova-os')?.reset();
    
    document.getElementById('outros-valores').value = '0,00';
    document.getElementById('outros-porcentagem').innerText = '+ 0.00%';
    document.getElementById('desconto-valor').value = '0,00';
    document.getElementById('desconto-porcentagem').innerText = 'Representa 0.00%';
    
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

        // FUNÇÃO BLINDADA: Tenta preencher; se o HTML não existir, não quebra o código.
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
        console.error("ERRO GRAVE AO BUSCAR DADOS DA O.S:", error);
        throw error; // Repassa o erro para o botão que chamou
    }
};

window.salvarOs = async function(event) {
    event.preventDefault();
    if(window.modoLeitura) return;

    // FUNÇÃO BLINDADA: Lê com fallback caso o HTML não exista
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
        if (window.mostrarToast) window.mostrarToast("Erro ao gravar O.S. Limpe o Cache do Supabase (Veja o console).", "erro");
    }
};

window.editarOs = async function(id) {
    try { 
        window.modoLeitura = false; 
        await window.buscarDadosOs(id); 
        window.alternarModoLeitura(false); 
        window.configurarRastreioAlteracoes(); 
        document.getElementById('modal-os')?.classList.remove('hidden'); 
        document.getElementById('modal-os')?.classList.add('flex'); 
    } catch (e) {
        console.error("ERRO AO EDITAR:", e);
        if(window.mostrarToast) window.mostrarToast("Erro ao abrir O.S: Limpe o Cache do Supabase e aperte CTRL+F5.", "erro");
    }
};

window.visualizarOs = async function(id) {
    try { 
        window.modoLeitura = true; 
        await window.buscarDadosOs(id); 
        window.alternarModoLeitura(true); 
        document.getElementById('modal-os')?.classList.remove('hidden'); 
        document.getElementById('modal-os')?.classList.add('flex'); 
    } catch (e) {
        console.error("ERRO AO VISUALIZAR:", e);
        if(window.mostrarToast) window.mostrarToast("Erro ao abrir O.S: Limpe o Cache do Supabase e aperte CTRL+F5.", "erro");
    }
};

window.excluirOs = async function(id, placa, numeroOs) {
    const confirmou = await window.abrirConfirmacao("Excluir O.S.", `Deseja eliminar a O.S. #${numeroOs}?`, "perigo");
    if (!confirmou) return;
    try { await supabase.from('itens_orcamento').delete().eq('os_id', id); await supabase.from('ordens_servico').delete().eq('id', id); if (window.mostrarToast) window.mostrarToast("O.S. eliminada!", "sucesso"); window.carregarOrdensServico(); } catch (e) { if (window.mostrarToast) window.mostrarToast("Erro ao eliminar.", "erro"); }
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
    
    if (window.modoLeitura) {
        if(btnX) btnX.classList.remove('hidden');
        if(btnFecharOs) btnFecharOs.classList.add('hidden');
        return;
    }
    if (window.formAlterado) {
        if(btnX) btnX.classList.add('hidden');
    } else {
        if(btnX) btnX.classList.remove('hidden');
    }
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
        window.atualizarTotaisOrcamento();
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
// 7. FECHAMENTO FINANCEIRO E PARCELAMENTO (ARREDONDAMENTO BANCÁRIO EXATO)
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
    
    if (operacao === 'PIX' || operacao === 'Dinheiro') {
        dataAtual.setDate(dataAtual.getDate() + 1); // Dia seguinte
    } else {
        dataAtual.setMonth(dataAtual.getMonth() + 1); // Próximo Mês exato
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

    // ARREDONDAMENTO BANCÁRIO MATEMÁTICO (Joga centavos pra cima)
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

        const dataFormatada = dataAtual.toLocaleDateString('pt-BR');
        html += `
            <tr class="border-b border-gray-100 dark:border-gray-800 transition-all">
                <td class="p-2 text-center font-bold text-gray-700 dark:text-gray-300">${i}/${parcelas}</td>
                <td class="p-2 font-mono font-bold text-gray-600 dark:text-gray-400">${dataFormatada}</td>
                <td class="p-2 text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">${operacao}</td>
                <td class="p-2 text-right font-mono font-black text-amber-600 dark:text-amber-500">R$ ${valorDaParcela.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                <td class="p-2"><input type="text" placeholder="NSU/Doc (Opcional)" class="w-full px-2 py-1.5 text-xs font-mono font-bold border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-[#0f172a] dark:text-white rounded outline-none focus:border-amber-500 transition-colors"></td>
            </tr>
        `;
        dataAtual.setMonth(dataAtual.getMonth() + 1);
    }
    tbody.innerHTML = html;
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
    const confirmou = await window.abrirConfirmacao("Concluir O.S.", "Confirmar o fechamento definitivo e a geração do financeiro?", "aviso");
    if(!confirmou) return;
    
    try {
        const elConclusao = document.getElementById('fechamento-conclusao');
        const dataConclusao = elConclusao ? elConclusao.value : null;
        const novaSituacao = 'Aguardando Pagamento';

        const { error } = await supabase.from('ordens_servico').update({
            situacao: novaSituacao,
            status: novaSituacao,
            data_conclusao: dataConclusao
        }).eq('id', window.osEmEdicaoId);
        
        if (error) throw error;

        if(window.mostrarToast) window.mostrarToast("O.S. Fechada com Sucesso!", "sucesso");
        const modalFech = document.getElementById('modal-fechamento-os');
        if(modalFech) modalFech.classList.add('hidden');
        window.fecharModalOsDireto();
        window.carregarOrdensServico();
    } catch(e) {
        console.error(e);
        if(window.mostrarToast) window.mostrarToast("Erro ao processar o fechamento.", "erro");
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
