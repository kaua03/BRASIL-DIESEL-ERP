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
    let p = placa.toUpperCase().replace(/[^A-Z0-9-]/g, '');
    if (/^[A-Z]{3}[0-9]{4}$/.test(p)) return p.substring(0, 3) + '-' + p.substring(3, 7);
    return p;
};

window.mascaraPlaca = function(input) {
    let p = input.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
    input.value = p;
    if (typeof window.atualizarTituloModalOs === 'function') window.atualizarTituloModalOs(window.osNumeroAtual, input.value);
};

window.validarPlacaBrasil = function(placa) {
    if (!placa || placa.length < 3) return false;
    return true; 
};

window.mascaraCpfCnpj = function(input) {
    let v = input.value.replace(/\D/g, "");
    if (v.length <= 11) v = v.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    else v = v.substring(0, 14).replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2");
    input.value = v;
};

window.mascaraCelular = function(input) {
    let v = input.value.replace(/\D/g, "").substring(0, 11);
    v = v.replace(/^(\d{2})(\d)/g, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
    input.value = v;
};

window.mascaraCep = function(input) {
    let v = input.value.replace(/\D/g, "").substring(0, 8);
    v = v.replace(/^(\d{5})(\d)/, "$1-$2");
    input.value = v;
};

window.mascaraValorItem = function(input) {
    let v = input.value.replace(/\D/g, '');
    if (v === "") { input.value = ""; return; }
    input.value = (parseInt(v, 10) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

window.consultarCnpj = async function(input) {
    let doc = input.value.replace(/\D/g, '');
    if (doc.length === 14) {
        if (window.mostrarToast) window.mostrarToast("Consultando CNPJ...", "aviso");
        try {
            let res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${doc}`);
            if (res.ok) {
                let dados = await res.json();
                document.getElementById('cliente').value = (dados.razao_social || dados.nome_fantasia || '').trim();
                if (dados.ddd_telefone_1) {
                    document.getElementById('celular').value = dados.ddd_telefone_1;
                    window.mascaraCelular(document.getElementById('celular'));
                }
                if (dados.email && dados.email.trim() !== "") document.getElementById('cliente_email').value = String(dados.email).toLowerCase().trim();
                if (dados.numero) document.getElementById('numero_end').value = String(dados.numero).trim();
                if (dados.cep) {
                    document.getElementById('cep').value = String(dados.cep).replace(/\D/g, '').replace(/^(\d{5})(\d{3})$/, "$1-$2");
                    window.consultarCep(document.getElementById('cep'));
                }
                if (window.mostrarToast) window.mostrarToast("Dados do CNPJ preenchidos!", "sucesso");
            }
        } catch (e) { console.error(e); }
    }
};

window.consultarCep = async function(input) {
    let cep = input.value.replace(/\D/g, '');
    if (cep.length === 8) {
        try {
            let res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            if (res.ok) {
                let dados = await res.json();
                if (!dados.erro) {
                    document.getElementById('endereco').value = (dados.logradouro || '').trim();
                    document.getElementById('bairro').value = (dados.bairro || '').trim();
                    document.getElementById('cidade').value = `${(dados.localidade || '').trim()} / ${(dados.uf || '').trim()}`;
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
            const achou = window.listaVeiculosBdd.find(v => v.modelo && v.modelo.toUpperCase() === mod);
            if (achou && achou.marca) {
                document.getElementById('marca').value = achou.marca.toUpperCase();
            }
        }
    }
});

// =========================================================================
// 3. MODO LEITURA E CORES DE STATUS (REVISADO)
// =========================================================================
window.alternarModoLeitura = function(ativo) {
    window.modoLeitura = ativo;
    const form = document.getElementById('form-nova-os');
    if (!form) return;

    // Desativa/Ativa inputs
    form.querySelectorAll('input, select, textarea').forEach(el => {
        if (el.type !== 'hidden') el.disabled = ativo;
    });

    const btnFecharOs = document.getElementById('btn-fechar-os');
    const btnBalcao = document.getElementById('btn-os-balcao'); 
    const cabecalho = document.getElementById('cabecalho-modal-os');
    const painelEdicao = document.getElementById('painel-botoes-edicao'); // Bloco do botão Salvar e Cancelar
    const painelAdicionar = document.getElementById('painel-adicionar-item'); // Bloco de Add Peças

    if (ativo) {
        if (btnFecharOs) btnFecharOs.classList.add('hidden');
        if (btnBalcao) btnBalcao.classList.add('hidden'); 
        if (painelEdicao) painelEdicao.classList.add('hidden'); // ESCONDE SALVAR
        if (painelAdicionar) painelAdicionar.classList.add('hidden'); // ESCONDE ADICIONAR ITEM
        if (cabecalho) { cabecalho.classList.remove('bg-[#1a428a]'); cabecalho.classList.add('bg-gray-700'); }
    } else {
        if (btnFecharOs) btnFecharOs.classList.remove('hidden');
        if (btnBalcao) btnBalcao.classList.remove('hidden'); 
        if (painelEdicao) painelEdicao.classList.remove('hidden'); // MOSTRA SALVAR
        if (painelAdicionar) painelAdicionar.classList.remove('hidden'); // MOSTRA ADICIONAR ITEM
        if (cabecalho) { cabecalho.classList.add('bg-[#1a428a]'); cabecalho.classList.remove('bg-gray-700'); }
    }

    window.renderizarTabelaOrcamento();
    window.atualizarVisibilidadeBotoesFechamento();
};

window.obterCoresStatus = function(situacao) {
    switch(situacao) {
        case 'Aberto': return 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400 border-sky-200';
        case 'Orçamento': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200';
        case 'Aguardando Autorização': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200'; // Cor Laranja
        case 'Aguardando Peça': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200'; // Cor Amarela Escura
        case 'Aguardando Pagamento': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200';
        case 'Autorizado': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200';
        case 'Em Execução': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400 border-indigo-200';
        case 'Garantia': return 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400 border-teal-200';
        case 'Não Usar': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200';
        case 'Recusado': return 'bg-red-200 text-red-900 dark:bg-red-900/50 dark:text-red-300 border-red-300';
        default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 border-gray-200';
    }
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

// MOTOR ANTI-CORTE DO DROPDOWN DE AÇÕES
window.toggleDrop = function(id, btnElement) {
    document.querySelectorAll('.menu-acao-os').forEach(el => {
        if (el.id !== `menu-${id}`) el.classList.add('hidden');
    });

    const menu = document.getElementById(`menu-${id}`);
    if (!menu) return;

    if (menu.classList.contains('hidden')) {
        menu.classList.remove('hidden');
        
        // MÁGICA: Fixa o menu para ele nunca ser cortado pelo overflow da tabela
        const rect = btnElement.getBoundingClientRect();
        menu.style.position = 'fixed'; 
        menu.style.zIndex = '99999';
        
        const menuWidth = 192; 
        const menuHeight = menu.offsetHeight || 160;

        let topPos = rect.bottom + 4;
        // Se bater no fundo da tela, abre para cima
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

// Fechar ao dar scroll para não ficar o menu voando na tela
document.addEventListener('scroll', function(event) {
    document.querySelectorAll('.menu-acao-os').forEach(el => el.classList.add('hidden'));
}, { capture: true });

window.alterarStatusOsInline = async function(id, selectElement) {
    const novaSituacao = selectElement.value;
    selectElement.className = `text-[10px] uppercase px-2 py-1.5 rounded-lg font-black tracking-wider outline-none cursor-pointer text-center text-center-last border shadow-sm transition-colors w-full max-w-[140px] ${window.obterCoresStatus(novaSituacao)}`;

    try {
        const { error } = await supabase.from('ordens_servico').update({ situacao: novaSituacao, status: novaSituacao }).eq('id', id);
        if (error) throw error;
        if (window.mostrarToast) window.mostrarToast("Situação atualizada!", "sucesso");
    } catch (e) {
        console.error(e);
        if (window.mostrarToast) window.mostrarToast("Erro ao atualizar situação.", "erro");
        window.carregarOrdensServico(); 
    }
};

// =========================================================================
// 4. FÁBRICA DE PDF E WHATSAPP (NOVO ICONE E LINKS)
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
                    <td style="padding: 4px; border-right: 1px solid #ccc;">${(i.descricao || '').toUpperCase()}</td>
                    <td style="padding: 4px; border-right: 1px solid #ccc; text-align: center;">PC</td>
                    <td style="padding: 4px; border-right: 1px solid #ccc; text-align: center;">${(i.quantidade || 1).toLocaleString('pt-BR', {minimumFractionDigits: 4})}</td>
                    <td style="padding: 4px; border-right: 1px solid #ccc; text-align: right;">R$ ${(i.valor_unitario || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                    <td style="padding: 4px; text-align: right;">R$ ${(i.subtotal || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                </tr>
            `;
        } else {
            htmlServicos += `
                <tr style="border-bottom: 1px solid #ccc; font-size: 10px;">
                    <td style="padding: 4px; border-right: 1px solid #ccc;">${String(idx + 1).padStart(4, '0')} - ${(i.descricao || '').toUpperCase()}</td>
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
                    <p style="margin: 2px 0;"><strong>Cliente:</strong> ${(os.cliente || '---').toUpperCase()}</p>
                    <p style="margin: 2px 0;"><strong>Endereço:</strong> ${os.endereco || '---'}</p>
                    <p style="margin: 2px 0;"><strong>Bairro:</strong> ${os.bairro || '---'}</p>
                    <p style="margin: 2px 0;"><strong>Cnpj/Cpf:</strong> ${os.cpf_cnpj || '---'}</p>
                    <p style="margin: 2px 0;"><strong>Solicitante:</strong> ---</p>
                </div>
                <div>
                    <p style="margin: 2px 0;"><strong>Telefone:</strong> ${os.celular || '---'}</p>
                    <p style="margin: 2px 0;"><strong>Cep:</strong> ${os.cep || '---'}</p>
                    <p style="margin: 2px 0;"><strong>Cidade:</strong> ${os.cidade || '---'}</p>
                    <p style="margin: 2px 0;"><strong>Inscrição Est.:</strong> ${os.inscricao_estadual || '---'}</p>
                </div>
            </div>

            <div style="border: 1px solid #000; padding: 8px; margin-bottom: 10px; font-size: 10px; line-height: 1.4;">
                <div style="display: flex; gap: 20px;">
                    <p style="margin: 2px 0; flex: 2;"><strong>Veículo:</strong> ${(os.modelo || '---').toUpperCase()}</p>
                    <p style="margin: 2px 0; flex: 1;"><strong>Marca:</strong> ${(os.marca || '---').toUpperCase()}</p>
                    <p style="margin: 2px 0; flex: 1;"><strong>Ano/Modelo:</strong> ${os.ano || '---'}</p>
                    <p style="margin: 2px 0; flex: 1;"><strong>KM:</strong> ${os.km_veiculo || '---'}</p>
                </div>
            </div>

            <div style="border: 1px solid #000; padding: 8px; margin-bottom: 10px; font-size: 10px;">
                <strong>RELATO / DEFEITO:</strong><br>
                ${(os.defeito || 'Nenhum relato registrado.').toUpperCase()}
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
                    <p style="margin: 0;"><strong>Resp. Lançamento:</strong> ${(os.responsavel || '---').toUpperCase()}</p>
                    <p style="margin: 0;"><strong>Placa:</strong> ${placaDoc}</p>
                </div>
                
                <div style="width: 40%; font-size: 10px; line-height: 1.5;">
                    <div style="display: flex; justify-content: space-between;"><span>Total de Peças (+):</span> <span>R$ ${tPecas.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span></div>
                    <div style="display: flex; justify-content: space-between;"><span>Total Serviços (+):</span> <span>R$ ${tServ.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span></div>
                    <div style="display: flex; justify-content: space-between;"><span>Outros Vlrs (+):</span> <span>R$ ${(os.outros_valores || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span></div>
                    <div style="display: flex; justify-content: space-between; color: red;"><span>Desconto (-):</span> <span>R$ ${(os.desconto || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span></div>
                    <div style="display: flex; justify-content: space-between; font-weight: 900; font-size: 13px; border-top: 1px solid #000; margin-top: 4px; padding-top: 4px;">
                        <span>Total Líquido (=):</span> <span>R$ ${Math.max(0, tPecas + tServ + (os.outros_valores || 0) - (os.desconto || 0)).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
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
    } catch (e) { console.error(e); }
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
    } catch (e) { console.error(e); if (window.mostrarToast) window.mostrarToast("Erro ao gerar PDF.", "erro"); }
};

window.enviarWhatsAppDaLista = async function(id, celular) {
    const menu = document.getElementById(`menu-${id}`);
    if(menu) menu.classList.add('hidden');

    const telLimpo = (celular || '').replace(/\D/g, '');
    if (telLimpo.length < 10) {
        if (window.mostrarToast) window.mostrarToast("Cliente sem WhatsApp válido!", "erro");
        return;
    }

    if (window.mostrarToast) window.mostrarToast("Gerando link seguro...", "aviso");

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

        const cliente = (os.cliente || 'Cliente').trim();
        const calcTotalGeral = Math.max(0, (os.total_pecas || 0) + (os.total_servicos || 0) + Number(os.outros_valores || 0) - Number(os.desconto || 0));

        // INJEÇÃO DA LÓGICA DOS 2 LINKS DE WHATSAPP
        const linkLaudoTexto = os.url_laudo ? `\n*Acesse o Laudo Técnico e Evidências do Laboratório:* \n${os.url_laudo}\n` : '';

        const mensagem = `Olá, *${cliente}*!\n\nAqui é da *Brasil Diesel Performance*.\nSua Ordem de Serviço *#${osNum}* (Placa: ${window.formatarPlaca(os.placa)}) foi atualizada.\n\n*Situação Atual:* ${os.situacao || 'Aberto'}\n*Valor Total:* R$ ${calcTotalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n\n *Acesse seu Orçamento Detalhado em PDF aqui:* \n${linkPdf}\n${linkLaudoTexto}\nQualquer dúvida, estamos à disposição!`;
        
        const url = `https://wa.me/55${telLimpo}?text=${encodeURIComponent(mensagem)}`;
        window.open(url, '_blank');

    } catch (e) {
        console.error(e);
        if (window.mostrarToast) window.mostrarToast("Erro ao processar integração.", "erro");
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
            
            let iconeNotificacao = os.lab_atualizado ? `<button onclick="window.visualizarNotificacaoLab(${os.id}, '${numeroFormatado}', '${os.placa}', '${os.situacao}')" class="absolute -left-6 text-red-500 hover:text-red-700 animate-pulse"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" /></svg></button>` : '';

            const bgStatus = window.obterCoresStatus(os.situacao);

            return `
                <tr class="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors border-b border-gray-100 dark:border-gray-700">
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
                        <select onchange="window.alterarStatusOsInline(${os.id}, this)" class="${bgStatus} text-[10px] uppercase px-2 py-1.5 rounded-lg font-black tracking-wider outline-none cursor-pointer text-center text-center-last border shadow-sm transition-colors w-full max-w-[140px]">
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
                            <!-- Botões de Ação Direta (Mais rápidos para a Oficina) -->
                            <button onclick="window.visualizarOs(${os.id})" class="text-blue-500 hover:text-blue-700 bg-white hover:bg-blue-50 dark:bg-gray-800 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600 p-2 rounded-lg transition-colors shadow-sm" title="Ver Detalhes">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                            </button>
                            <button onclick="window.editarOs(${os.id})" class="text-amber-500 hover:text-amber-700 bg-white hover:bg-amber-50 dark:bg-gray-800 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600 p-2 rounded-lg transition-colors shadow-sm" title="Editar O.S">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </button>
                            <button onclick="window.excluirOs(${os.id}, '${os.placa}', '${numeroFormatado}')" class="text-red-500 hover:text-red-700 bg-white hover:bg-red-50 dark:bg-gray-800 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600 p-2 rounded-lg transition-colors shadow-sm" title="Eliminar O.S">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>

                            <!-- Dropdown de 3 Pontinhos -->
                            <button onclick="window.toggleDrop(${os.id}, this)" class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 border border-transparent dark:border-gray-600 p-2 rounded-lg transition-colors shadow-sm" title="Mais Opções">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" /></svg>
                            </button>

                            <div id="menu-${os.id}" class="menu-acao-os hidden w-48 bg-white dark:bg-[#1e293b] rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 py-2 text-left" style="min-width: 180px;">
                                <button onclick="window.imprimirOsDaLista(${os.id})" class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 font-bold flex items-center gap-2"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg> Imprimir O.S</button>
                                <button onclick="window.salvarComoPdfDaLista(${os.id})" class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 font-bold flex items-center gap-2"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg> Baixar PDF</button>
                                
                                <!-- NOVO WHATSAPP COM ÍCONE OFICIAL E 2 LINKS -->
                                <button onclick="window.enviarWhatsAppDaLista(${os.id}, '${os.celular || ''}')" class="w-full text-left px-4 py-2 text-sm text-[#25D366] hover:bg-green-50 dark:hover:bg-green-900/20 font-bold flex items-center gap-2 border-t border-gray-100 dark:border-gray-700 mt-1">
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

window.visualizarNotificacaoLab = async function(osId, osNum, placa, situacao) {
    const confirmou = await window.abrirConfirmacao("Aviso do Laboratório", "O laboratório atualizou esta O.S. Deseja remover o aviso e ir para o painel do laboratório?", "aviso");
    if (!confirmou) return;

    try {
        await supabase.from('ordens_servico').update({ lab_atualizado: false }).eq('id', osId);
        
        const btnLab = document.querySelector('.nav-btn[data-tela="lab"]');
        if (btnLab) {
            btnLab.click();
            setTimeout(() => {
                if (window.abrirGestaoPecas) window.abrirGestaoPecas(osId, osNum, placa, situacao);
            }, 500);
        }
        window.carregarOrdensServico();
    } catch (e) { console.error(e); }
};

// =========================================================================
// 6. GESTÃO DO MODAL E RASTREIO DE RESPONSÁVEL (DevSecOps)
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
    const { data: os, error } = await supabase.from('ordens_servico').select('*').eq('id', id).single();
    if (error) throw error;

    window.osEmEdicaoId = os.id;
    window.osEmEdicaoNumero = os.numero_os || os.id;
    window.osNumeroAtual = os.numero_os || os.id;
    window.itemEmEdicaoId = null;

    document.getElementById('data_hora').value = os.data_hora ? os.data_hora.slice(0, 16) : '';
    document.getElementById('responsavel_os').value = os.responsavel || 'SISTEMA';
    document.getElementById('setor_destino').value = os.setor_destino || 'Pátio';
    
    document.getElementById('placa').value = window.formatarPlaca(os.placa);
    document.getElementById('modelo').value = (os.modelo || '').trim();
    document.getElementById('marca').value = (os.marca || '').trim();
    document.getElementById('ano').value = (os.ano || '').trim();
    document.getElementById('km_veiculo').value = (os.km_veiculo || '').trim();
    
    document.getElementById('cpf_cnpj').value = (os.cpf_cnpj || '').trim();
    document.getElementById('inscricao_estadual').value = (os.inscricao_estadual || '').trim();
    document.getElementById('cliente').value = (os.cliente || '').trim();
    document.getElementById('celular').value = (os.celular || '').trim();
    document.getElementById('cliente_email').value = (os.email || '').trim();
    document.getElementById('cep').value = (os.cep || '').trim();
    document.getElementById('endereco').value = (os.endereco || '').trim();
    document.getElementById('bairro').value = (os.bairro || '').trim();
    document.getElementById('cidade').value = (os.cidade || '').trim();
    document.getElementById('numero_end').value = (os.numero_end || '').trim();
    document.getElementById('complemento').value = (os.complemento || '').trim();
    
    document.getElementById('outros-valores').value = (os.outros_valores || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    document.getElementById('desconto-tipo').value = os.desconto_tipo || 'total';
    document.getElementById('desconto-valor').value = (os.desconto || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

    const sel = document.getElementById('situacao');
    if(sel) { sel.value = os.situacao || 'Aberto'; window.atualizarCorSelectSituacao(sel); }
    document.getElementById('defeito').value = (os.defeito || '').trim();

    const { data: itens } = await supabase.from('itens_orcamento').select('*').eq('os_id', id);
    window.itensOrcamento = itens ? itens.map(i => ({ id: i.id || Date.now(), tipo: i.tipo, descricao: i.descricao, qtd: i.quantidade, valorUnitario: i.valor_unitario, subtotal: i.subtotal, concluido: i.concluido })) : [];

    window.atualizarTituloModalOs(window.osNumeroAtual, os.placa);
    window.atualizarTopHeaderVisualizacao(os); // PREPARA O TOP HEADER HTML
};

window.atualizarTopHeaderVisualizacao = function(os) {
    // Alimenta os campos que criaremos no HTML do Topo
    const hCliente = document.getElementById('header-view-cliente');
    const hVeiculo = document.getElementById('header-view-veiculo');
    const hPlaca = document.getElementById('header-view-placa');
    if(hCliente) hCliente.innerText = (os.cliente || 'CLIENTE NÃO INFORMADO').toUpperCase();
    if(hVeiculo) hVeiculo.innerText = (os.modelo || 'VEÍCULO NÃO INFORMADO').toUpperCase();
    if(hPlaca) hPlaca.innerText = window.formatarPlaca(os.placa);
};

window.salvarOs = async function(event) {
    event.preventDefault();
    if(window.modoLeitura) return;

    const placa = window.formatarPlaca(document.getElementById('placa').value);
    if (!window.validarPlacaBrasil(placa)) {
        if (window.mostrarToast) window.mostrarToast("Placa inválida!", "erro");
        document.getElementById('placa').focus(); return;
    }
    
    const tPecas = window.itensOrcamento.filter(i => i.tipo === 'Peça').reduce((acc, i) => acc + (Number(i.subtotal) || 0), 0);
    const tServ = window.itensOrcamento.filter(i => i.tipo === 'Serviço').reduce((acc, i) => acc + (Number(i.subtotal) || 0), 0);
    const valOutros = parseFloat(document.getElementById('outros-valores').value.replace(/\./g, '').replace(',', '.')) || 0;
    const valDesconto = parseFloat(document.getElementById('desconto-valor').value.replace(/\./g, '').replace(',', '.')) || 0;
    const calcTotalGeral = Math.max(0, tPecas + tServ + valOutros - valDesconto);

    const dadosOs = {
        data_hora: document.getElementById('data_hora').value,
        responsavel: document.getElementById('responsavel_os').value,
        setor_destino: document.getElementById('setor_destino').value,
        placa: placa, veiculo_placa: placa.replace('-', ''),
        modelo: document.getElementById('modelo').value.trim(), 
        marca: document.getElementById('marca').value.trim(),
        ano: document.getElementById('ano').value.trim(), 
        km_veiculo: document.getElementById('km_veiculo').value.trim(),
        cpf_cnpj: document.getElementById('cpf_cnpj').value.trim(),
        inscricao_estadual: document.getElementById('inscricao_estadual').value.trim(),
        cliente: document.getElementById('cliente').value.trim(), 
        celular: document.getElementById('celular').value.trim(),
        email: document.getElementById('cliente_email').value.trim(), 
        cep: document.getElementById('cep').value.trim(),
        endereco: document.getElementById('endereco').value.trim(), 
        bairro: document.getElementById('bairro').value.trim(),
        cidade: document.getElementById('cidade').value.trim(), 
        numero_end: document.getElementById('numero_end').value.trim(),
        complemento: document.getElementById('complemento').value.trim(), 
        situacao: document.getElementById('situacao').value,
        status: document.getElementById('situacao').value, 
        defeito: document.getElementById('defeito').value.trim(),
        total_pecas: tPecas,
        total_servicos: tServ,
        outros_valores: valOutros,
        desconto_tipo: document.getElementById('desconto-tipo').value,
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
        if (window.mostrarToast) window.mostrarToast("Erro ao gravar O.S. (Veja o console)", "erro");
    }
};

window.editarOs = async function(id) {
    try { window.modoLeitura = false; await window.buscarDadosOs(id); window.alternarModoLeitura(false); window.configurarRastreioAlteracoes(); document.getElementById('modal-os')?.classList.remove('hidden'); document.getElementById('modal-os')?.classList.add('flex'); } catch (e) {}
};

window.visualizarOs = async function(id) {
    try { window.modoLeitura = true; await window.buscarDadosOs(id); window.alternarModoLeitura(true); document.getElementById('modal-os')?.classList.remove('hidden'); document.getElementById('modal-os')?.classList.add('flex'); } catch (e) {}
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
        tbody.innerHTML = `<tr><td colspan="${colspan}" class="p-6 text-center text-gray-400 font-medium">Nenhum item adicionado.</td></tr>`;
        window.atualizarTotaisOrcamento();
        return;
    }

    tbody.innerHTML = window.itensOrcamento.map((item, idx) => {
        const tdAcao = window.modoLeitura ? '' : `
            <td class="p-3 text-center whitespace-nowrap">
                <button type="button" onclick="window.editarItemOrcamento(${item.id})" class="text-blue-500 hover:text-blue-700 mr-2"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                <button type="button" onclick="window.removerItemOrcamento(${item.id})" class="text-red-500 font-black text-xl hover:text-red-700">&times;</button>
            </td>`;
            
        return `
        <tr class="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-[#0f172a] transition-colors">
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

    const txtOutros = document.getElementById('outros-valores')?.value || '0,00';
    const tipoDesconto = document.getElementById('desconto-tipo')?.value || 'total';
    const txtDesconto = document.getElementById('desconto-valor')?.value || '0,00';
    
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
        vDesconto = tPecas; document.getElementById('desconto-valor').value = vDesconto.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    } else if (tipoDesconto === 'servicos' && vDesconto > tServ) {
        vDesconto = tServ; document.getElementById('desconto-valor').value = vDesconto.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    } else if (tipoDesconto === 'total' && vDesconto > subtotalBruto) {
        vDesconto = subtotalBruto; document.getElementById('desconto-valor').value = vDesconto.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
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

    document.getElementById('qtd-total-itens').innerText = qtdTotal;
    document.getElementById('total-pecas').innerText = 'R$ ' + tPecas.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    document.getElementById('total-servicos').innerText = 'R$ ' + tServ.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    document.getElementById('total-geral').innerText = 'R$ ' + Math.max(0, totalGeral).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
};

// =========================================================================
// 7. FECHAMENTO FINANCEIRO: PARCELAMENTO BANCÁRIO EXATO E VENCIMENTOS
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
    document.getElementById('fechamento-total').innerText = document.getElementById('total-geral').innerText;
    window.calcularRestanteFechamento();
    
    // Set datas padrão antes da alteração de operação
    document.getElementById('fechamento-vencimento').value = new Date().toISOString().split('T')[0];
    const agora = new Date(); agora.setMinutes(agora.getMinutes() - agora.getTimezoneOffset());
    document.getElementById('fechamento-conclusao').value = agora.toISOString().slice(0,16);
    document.getElementById('fechamento-entrega').value = new Date().toISOString().split('T')[0];
    
    // Dispara a lógica de data +1 Dia ou +1 Mês de acordo com a operação
    window.atualizarVencimentoPorOperacao();
    window.calcularGarantia();
    
    document.getElementById('modal-fechamento-os').classList.remove('hidden');
    document.getElementById('modal-fechamento-os').classList.add('flex');
};

window.atualizarVencimentoPorOperacao = function() {
    const operacao = document.getElementById('fechamento-operacao').value;
    const inputVenc = document.getElementById('fechamento-vencimento');
    const dataAtual = new Date();
    
    if (operacao === 'PIX' || operacao === 'Dinheiro') {
        dataAtual.setDate(dataAtual.getDate() + 1); // Dia seguinte
    } else {
        dataAtual.setMonth(dataAtual.getMonth() + 1); // Próximo Mês
    }
    
    // Corrige fuso horário para bater exato com o Brasil
    const dataLocal = new Date(dataAtual.getTime() - (dataAtual.getTimezoneOffset() * 60000));
    inputVenc.value = dataLocal.toISOString().split('T')[0];
    window.gerarPreviewParcelas();
};

window.calcularRestanteFechamento = function() {
    const totalTxt = document.getElementById('fechamento-total').innerText;
    const entradaTxt = document.getElementById('fechamento-entrada').value || '0,00';
    
    const vTotal = parseFloat(totalTxt.replace('R$ ', '').replace(/\./g, '').replace(',', '.')) || 0;
    const vEntrada = parseFloat(entradaTxt.replace(/\./g, '').replace(',', '.')) || 0;
    
    const restante = Math.max(0, vTotal - vEntrada);
    document.getElementById('fechamento-restante').innerText = 'R$ ' + restante.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    window.gerarPreviewParcelas();
};

window.gerarPreviewParcelas = function() {
    const restanteTxt = document.getElementById('fechamento-restante').innerText;
    const restante = parseFloat(restanteTxt.replace('R$ ', '').replace(/\./g, '').replace(',', '.')) || 0;
    const parcelas = parseInt(document.getElementById('fechamento-parcelas').value) || 1;
    const operacao = document.getElementById('fechamento-operacao').value;
    const venciInicial = document.getElementById('fechamento-vencimento').value;
    const tbody = document.getElementById('tbody-preview-parcelas');
    
    if(restante <= 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-gray-500 font-bold">A entrada cobriu o valor total. Sem parcelas pendentes.</td></tr>';
        return;
    }

    // ARREDONDAMENTO BANCÁRIO EXATO (ex: 633.34, 633.34, 633.32)
    const valorParcelaBase = Math.ceil((restante / parcelas) * 100) / 100;
    
    let html = '';
    let dataAtual = new Date(venciInicial || new Date());
    if(venciInicial) dataAtual.setMinutes(dataAtual.getMinutes() + dataAtual.getTimezoneOffset()); 

    for(let i=1; i<=parcelas; i++) {
        let valorDaParcela = valorParcelaBase;
        
        // A última parcela ajusta a diferença dos centavos a maior
        if (i === parcelas) {
            valorDaParcela = restante - (valorParcelaBase * (parcelas - 1));
            valorDaParcela = Math.round(valorDaParcela * 100) / 100; // previne bugs de float no JS
        }

        const dataFormatada = dataAtual.toLocaleDateString('pt-BR');
        html += `
            <tr class="border-b border-gray-100 dark:border-gray-800">
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
    const entrega = document.getElementById('fechamento-entrega').value;
    const inputDias = document.getElementById('fechamento-garantia-dias');
    const dias = inputDias ? (parseInt(inputDias.value) || 0) : 90; // Default 90 se não achar o input
    
    if(entrega) {
        const dataGarantia = new Date(entrega);
        dataGarantia.setMinutes(dataGarantia.getMinutes() + dataGarantia.getTimezoneOffset());
        dataGarantia.setDate(dataGarantia.getDate() + dias);
        document.getElementById('fechamento-garantia').value = dataGarantia.toISOString().split('T')[0];
    }
};

window.confirmarFechamentoOS = async function() {
    const confirmou = await window.abrirConfirmacao("Concluir O.S.", "Confirmar o fechamento definitivo e a geração do financeiro?", "aviso");
    if(!confirmou) return;
    
    try {
        const dataConclusao = document.getElementById('fechamento-conclusao').value;
        const novaSituacao = 'Aguardando Pagamento';

        const { error } = await supabase.from('ordens_servico').update({
            situacao: novaSituacao,
            status: novaSituacao,
            data_conclusao: dataConclusao
        }).eq('id', window.osEmEdicaoId);
        
        if (error) throw error;

        if(window.mostrarToast) window.mostrarToast("O.S. Fechada com Sucesso!", "sucesso");
        document.getElementById('modal-fechamento-os').classList.add('hidden');
        window.fecharModalOsDireto();
        window.carregarOrdensServico();
    } catch(e) {
        console.error(e);
        if(window.mostrarToast) window.mostrarToast("Erro ao processar o fechamento.", "erro");
    }
};

window.preencherVeiculoAvulso = function() {
    const p = document.getElementById('placa'); const m = document.getElementById('modelo'); const ma = document.getElementById('marca'); const a = document.getElementById('ano');
    if (p) { p.value = 'AVULSA'; p.dispatchEvent(new Event('input')); }
    if (m) { m.value = 'VENDA BALCÃO / AVULSA'; m.dispatchEvent(new Event('input')); }
    if (ma) { ma.value = 'N/A'; ma.dispatchEvent(new Event('input')); }
    if (a) { a.value = new Date().getFullYear(); a.dispatchEvent(new Event('input')); }
    if(window.mostrarToast) window.mostrarToast("Modo O.S. Avulsa ativado!", "info");
};
