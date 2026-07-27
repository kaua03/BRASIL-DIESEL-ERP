// JS/modules/ordem.js
import { supabase } from './config.js';

window.itensOrcamento = [];
window.osEmEdicaoId = null;
window.osEmEdicaoNumero = null;
window.formAlterado = false;
window.modoLeitura = false;
window.itemEmEdicaoId = null;

// =========================================================================
// 1. MÁSCARAS E APIS (Corrigido para formato Universal - Mercosul e Antiga)
// =========================================================================
window.formatarPlaca = function(placa) {
    if (!placa) return '';
    let p = placa.toUpperCase().replace(/[^A-Z0-9]/g, '');
    
    // Se for o padrão Antigo exato (3 letras e 4 números), coloca o hífen
    if (/^[A-Z]{3}[0-9]{4}$/.test(p)) {
        return p.substring(0, 3) + '-' + p.substring(3, 7);
    }
    // Se for Mercosul ou incompleto, retorna limpo (ex: ASX5C03)
    return p;
};

window.mascaraPlaca = function(input) {
    let p = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    
    // Aplica o hífen apenas enquanto digita se for reconhecido como formato antigo
    if (p.length === 7 && /^[A-Z]{3}[0-9]{4}$/.test(p)) {
        input.value = p.substring(0, 3) + '-' + p.substring(3, 7);
    } else {
        input.value = p.substring(0, 7);
    }
    window.atualizarTituloModalOs(window.osNumeroAtual, input.value);
};

window.validarPlacaBrasil = function(placa) {
    return /^[A-Z]{3}-[0-9]{4}$/.test(placa) || /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(placa);
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
                else document.getElementById('cliente_email').value = '';
                if (dados.numero) document.getElementById('numero_end').value = String(dados.numero).trim();
                if (dados.cep) {
                    document.getElementById('cep').value = String(dados.cep).replace(/\D/g, '').replace(/^(\d{5})(\d{3})$/, "$1-$2");
                    window.consultarCep(document.getElementById('cep'));
                }
                if (window.mostrarToast) window.mostrarToast("Dados do CNPJ preenchidos!", "sucesso");
            } else {
                if (window.mostrarToast) window.mostrarToast("CNPJ não encontrado.", "erro");
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
// 2. MODO LEITURA E BOTÕES DE AÇÃO
// =========================================================================
window.alternarModoLeitura = function(ativo) {
    window.modoLeitura = ativo;
    const form = document.getElementById('form-nova-os');
    if (!form) return;

    form.querySelectorAll('input, select, textarea').forEach(el => {
        if (el.type !== 'hidden') el.disabled = ativo;
    });

    const painelAdd = document.getElementById('painel-adicionar-item');
    const thAcao = document.getElementById('th-acao-orcamento');
    const cabecalho = document.getElementById('cabecalho-modal-os');
    const painelEdicao = document.getElementById('painel-botoes-edicao');

    if (ativo) {
        painelAdd?.classList.add('hidden');
        thAcao?.classList.add('hidden');
        if (painelEdicao) {
            painelEdicao.classList.add('hidden');
            painelEdicao.style.display = 'none';
        }
        if (cabecalho) {
            cabecalho.classList.remove('bg-[#1a428a]');
            cabecalho.classList.add('bg-gray-700');
        }
    } else {
        painelAdd?.classList.remove('hidden');
        thAcao?.classList.remove('hidden');
        if (painelEdicao) {
            painelEdicao.classList.remove('hidden');
            painelEdicao.style.display = 'flex';
        }
        if (cabecalho) {
            cabecalho.classList.add('bg-[#1a428a]');
            cabecalho.classList.remove('bg-gray-700');
        }
    }

    window.renderizarTabelaOrcamento();
    window.atualizarVisibilidadeBotoesFechamento();
};

window.atualizarCorSelectSituacao = function(selectEl) {
    if (!selectEl) return;
    const val = selectEl.value;
    if (val === 'Aberto') { selectEl.style.backgroundColor = '#E0F2FE'; selectEl.style.color = '#0369A1'; }
    else if (val === 'Aguardando') { selectEl.style.backgroundColor = '#FEF3C7'; selectEl.style.color = '#B45309'; }
    else if (val === 'Autorizado') { selectEl.style.backgroundColor = '#DCFCE7'; selectEl.style.color = '#15803D'; }
    else if (val === 'Em Execução') { selectEl.style.backgroundColor = '#E0E7FF'; selectEl.style.color = '#3730A3'; }
    else if (val === 'Recusado') { selectEl.style.backgroundColor = '#FEE2E2'; selectEl.style.color = '#B91C1C'; }
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

// =========================================================================
// 3. CONTROLE DO MENU SUSPENSO E SITUAÇÃO INLINE
// =========================================================================
window.toggleDrop = function(id, btnElement) {
    document.querySelectorAll('.menu-acao-os').forEach(el => {
        if (el.id !== `menu-${id}`) el.classList.add('hidden');
    });

    const menu = document.getElementById(`menu-${id}`);
    if (!menu) return;

    if (menu.classList.contains('hidden')) {
        const rect = btnElement.getBoundingClientRect();
        menu.classList.remove('hidden');

        const menuWidth = 192; 
        let leftPos = rect.right - menuWidth; 
        if (leftPos < 10) leftPos = rect.left; 
        
        const menuHeight = menu.offsetHeight || 130;
        if (rect.bottom + menuHeight > window.innerHeight) {
            menu.style.top = `${rect.top - menuHeight - 4}px`;
        } else {
            menu.style.top = `${rect.bottom + 4}px`;
        }
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

document.addEventListener('scroll', function(event) {
    if (event.target.closest && event.target.closest('.menu-acao-os')) return;
    document.querySelectorAll('.menu-acao-os').forEach(el => el.classList.add('hidden'));
}, { capture: true });

window.alterarStatusOsInline = async function(id, selectElement) {
    const novaSituacao = selectElement.value;
    
    selectElement.className = 'text-[10px] uppercase px-2 py-1 rounded-full tracking-wider outline-none cursor-pointer text-center text-center-last transition-colors font-bold shadow-sm border border-transparent hover:border-gray-300';
    if (novaSituacao === 'Aberto') selectElement.classList.add('bg-sky-100', 'text-sky-800');
    else if (novaSituacao === 'Aguardando') selectElement.classList.add('bg-amber-100', 'text-amber-800');
    else if (novaSituacao === 'Autorizado') selectElement.classList.add('bg-emerald-100', 'text-emerald-800');
    else if (novaSituacao === 'Em Execução') selectElement.classList.add('bg-indigo-100', 'text-indigo-800');
    else if (novaSituacao === 'Recusado') selectElement.classList.add('bg-red-100', 'text-red-800');

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
// 4. FÁBRICA DE PDF E AÇÕES RÁPIDAS
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
                    <p style="margin: 2px 0;"><strong>Razão:</strong> ${(os.cliente || '---').toUpperCase()}</p>
                    <p style="margin: 2px 0;"><strong>Endereço:</strong> ${os.endereco || '---'}</p>
                    <p style="margin: 2px 0;"><strong>Bairro:</strong> ${os.bairro || '---'}</p>
                    <p style="margin: 2px 0;"><strong>Cnpj/Cpf:</strong> ${os.cpf_cnpj || '---'}</p>
                    <p style="margin: 2px 0;"><strong>Solicitante:</strong> ---</p>
                    <p style="margin: 2px 0;"><strong>Solicitação:</strong> ---</p>
                    <p style="margin: 2px 0;"><strong>Técnico:</strong> ---</p>
                </div>
                <div>
                    <p style="margin: 2px 0;"><strong>Registro:</strong> ---</p>
                    <p style="margin: 2px 0;"><strong>Operador:</strong> ---</p>
                    <p style="margin: 2px 0;"><strong>Telefone:</strong> ${os.celular || '---'}</p>
                    <p style="margin: 2px 0;"><strong>Cep:</strong> ${os.cep || '---'}</p>
                    <p style="margin: 2px 0;"><strong>Cidade:</strong> ${os.cidade || '---'}</p>
                    <p style="margin: 2px 0;"><strong>IE/RG:</strong> ---</p>
                    <p style="margin: 2px 0;"><strong>Vendedor:</strong> ---</p>
                    <p style="margin: 2px 0;"><strong>Acessórios:</strong> ---</p>
                </div>
            </div>

            <div style="border: 1px solid #000; padding: 8px; margin-bottom: 10px; font-size: 10px; line-height: 1.4;">
                <div style="display: flex; gap: 20px;">
                    <p style="margin: 2px 0; flex: 2;"><strong>Veículo:</strong> ${(os.modelo || '---').toUpperCase()}</p>
                    <p style="margin: 2px 0; flex: 1;"><strong>Marca:</strong> ${(os.marca || '---').toUpperCase()}</p>
                    <p style="margin: 2px 0; flex: 1;"><strong>Ano/Modelo:</strong> ${os.ano || '---'}</p>
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
                    <p style="margin: 0;"><strong>Vendedor:</strong> ---</p>
                    <p style="margin: 0;"><strong>Estado:</strong> MG</p>
                    <p style="margin: 0;"><strong>Chassi:</strong> ---</p>
                    <p style="margin: 0;"><strong>Placa:</strong> ${placaDoc} // <strong>Frota:</strong> ---</p>
                    <p style="margin: 0;"><strong>KM:</strong> ---</p>
                    <p style="margin: 0;"><strong>Cor:</strong> ---</p>
                    <p style="margin: 0;"><strong>UF:</strong> MG</p>
                </div>
                
                <div style="width: 40%; font-size: 10px; line-height: 1.5;">
                    <div style="display: flex; justify-content: space-between;"><span>Total de Peças (+):</span> <span>R$ ${tPecas.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span></div>
                    <div style="display: flex; justify-content: space-between;"><span>Total Serviços (+):</span> <span>R$ ${tServ.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span></div>
                    <div style="display: flex; justify-content: space-between;"><span>Outros Vlrs (+):</span> <span>R$ ${(os.outros_valores || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span></div>
                    <div style="display: flex; justify-content: space-between;"><span>Desconto (-):</span> <span>R$ ${(os.desconto || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span></div>
                    <div style="display: flex; justify-content: space-between;"><span>IR Retido (+):</span> <span>R$ 0,00</span></div>
                    <div style="display: flex; justify-content: space-between;"><span>INSS Retido (+):</span> <span>R$ 0,00</span></div>
                    <div style="display: flex; justify-content: space-between;"><span>ISS Retido (+):</span> <span>R$ 0,00</span></div>
                    <div style="display: flex; justify-content: space-between; font-weight: 900; font-size: 13px; border-top: 1px solid #000; margin-top: 4px; padding-top: 4px;">
                        <span>Total Doc (=):</span> <span>R$ ${Math.max(0, tPecas + tServ + (os.outros_valores || 0) - (os.desconto || 0)).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                    </div>
                </div>
            </div>

            <div style="margin-top: 60px; text-align: center; border-top: 1px solid #000; width: 350px; margin-left: auto; margin-right: auto; padding-top: 5px; font-weight: bold; font-size: 12px; page-break-inside: avoid;">
                Assinatura
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
        const agora = new Date();
        const dataFormatada = `${String(agora.getDate()).padStart(2, '0')}-${String(agora.getMonth() + 1).padStart(2, '0')}-${agora.getFullYear()}-${String(agora.getHours()).padStart(2, '0')}-${String(agora.getMinutes()).padStart(2, '0')}`;
        const nomeArquivo = `O.S_${osNum}_${dataFormatada}.pdf`;

        const opt = {
            margin: 0.1,
            filename: nomeArquivo,
            image: { type: 'jpeg', quality: 1 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
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

    const telLimpo = (celular || '').replace(/\D/g, '');
    if (telLimpo.length < 10) {
        if (window.mostrarToast) window.mostrarToast("Cliente sem WhatsApp válido!", "erro");
        return;
    }

    if (window.mostrarToast) window.mostrarToast("Gerando PDF e Link da Nuvem...", "aviso");

    try {
        const { data: os, error } = await supabase.from('ordens_servico').select('*').eq('id', id).single();
        if (error) throw error;
        const { data: itens, error: erroItens } = await supabase.from('itens_orcamento').select('*').eq('os_id', id);
        if (erroItens) throw erroItens;

        const conteudoHtml = window.gerarHtmlDocumentoOs(os, itens);
        
        const divContainer = document.createElement('div');
        divContainer.innerHTML = conteudoHtml;

        const osNum = String(os.numero_os || os.id || '0000').padStart(4, '0');
        const agora = new Date();
        const dataFormatada = `${String(agora.getDate()).padStart(2, '0')}-${String(agora.getMonth() + 1).padStart(2, '0')}-${agora.getFullYear()}-${String(agora.getHours()).padStart(2, '0')}-${String(agora.getMinutes()).padStart(2, '0')}`;
        const nomeArquivo = `O.S_${osNum}_${dataFormatada}.pdf`;

        const opt = {
            margin: 0.1,
            filename: nomeArquivo,
            image: { type: 'jpeg', quality: 1 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
        };

        const pdfBlob = await html2pdf().set(opt).from(divContainer.firstElementChild).output('blob');

        const { error: uploadError } = await supabase.storage
            .from('pdfs-os')
            .upload(nomeArquivo, pdfBlob, {
                contentType: 'application/pdf',
                upsert: true 
            });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage.from('pdfs-os').getPublicUrl(nomeArquivo);
        const linkPdf = publicUrlData.publicUrl;

        const cliente = (os.cliente || 'Cliente').trim();
        
        // Cálculo cravado da nuvem
        const tPecas = itens ? itens.filter(i => i.tipo === 'Peça').reduce((a, i) => a + (Number(i.subtotal) || 0), 0) : 0;
        const tServ = itens ? itens.filter(i => i.tipo === 'Serviço').reduce((a, i) => a + (Number(i.subtotal) || 0), 0) : 0;
        const calcTotalGeral = Math.max(0, tPecas + tServ + Number(os.outros_valores || 0) - Number(os.desconto || 0));

        const mensagem = `Olá, *${cliente}*!\n\nAqui é da *Brasil Diesel Performance*.\nSua Ordem de Serviço *#${osNum}* (Placa: ${window.formatarPlaca(os.placa)}) foi atualizada.\n\n*Situação Atual:* ${os.situacao || 'Aberto'}\n*Valor Total:* R$ ${calcTotalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n\n *Acesse seu Orçamento Detalhado em PDF aqui:* \n${linkPdf}\n\nQualquer dúvida, estamos à disposição!`;
        
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

    try {
        const { data, error } = await supabase.from('ordens_servico').select('*, itens_orcamento(*)').order('id', { ascending: false });
        if (error) throw error;

        if (!data || data.length === 0) {
            tabela.innerHTML = '<tr><td colspan="7" class="text-center p-8 text-gray-400 font-bold italic">Nenhuma O.S. registada.</td></tr>';
            return;
        }

        tabela.innerHTML = data.map(os => {
            try {
                const numeroFormatado = String(os.numero_os || os.id).padStart(4, '0');
                const dataFormatada = os.data_hora ? new Date(os.data_hora).toLocaleString('pt-BR') : '---';
                const placaFormatada = window.formatarPlaca(os.placa);
                
                const clienteFormatado = String(os.cliente || '---').trim().toUpperCase();
                const modeloUpper = String(os.modelo || '---').trim().toUpperCase();
                const anoStr = String(os.ano || '').trim();
                const veiculoFormatado = anoStr ? `${modeloUpper} - ${anoStr}` : modeloUpper;
                
                const qtdItens = os.itens_orcamento ? os.itens_orcamento.reduce((soma, i) => soma + (Number(i.quantidade) || 1), 0) : 0;
                
                const tPecas = os.itens_orcamento ? os.itens_orcamento.filter(i => i.tipo === 'Peça').reduce((a, i) => a + (Number(i.subtotal) || 0), 0) : 0;
                const tServ = os.itens_orcamento ? os.itens_orcamento.filter(i => i.tipo === 'Serviço').reduce((a, i) => a + (Number(i.subtotal) || 0), 0) : 0;
                const totalMatematico = Math.max(0, tPecas + tServ + Number(os.outros_valores || 0) - Number(os.desconto || 0));
                const valorTotalStr = totalMatematico.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

                // O SEGREDO DO SINO: absolute e -left-8
                let iconeNotificacao = '';
                if (os.lab_atualizado) {
                    iconeNotificacao = `
                    <button onclick="window.visualizarNotificacaoLab(${os.id}, '${numeroFormatado}', '${os.placa}', '${os.situacao}')" class="absolute -left-8 top-1/2 -translate-y-1/2 text-red-500 hover:text-red-700 animate-pulse transition-colors" title="Atualização do Laboratório! Clique para ver.">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 drop-shadow-sm" viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" /></svg>
                    </button>`;
                }

                let bgStatus = 'bg-gray-100 text-gray-800';
                if (os.situacao === 'Aberto') bgStatus = 'bg-sky-100 text-sky-800';
                else if (os.situacao === 'Aguardando') bgStatus = 'bg-amber-100 text-amber-800';
                else if (os.situacao === 'Autorizado') bgStatus = 'bg-emerald-100 text-emerald-800';
                else if (os.situacao === 'Em Execução') bgStatus = 'bg-indigo-100 text-indigo-800';
                else if (os.situacao === 'Recusado') bgStatus = 'bg-red-100 text-red-800';

                // O select em si herda a cor baseada no status atual
                const selectStatus = `
                    <select onchange="window.alterarStatusOsInline(${os.id}, this)" class="${bgStatus} text-[10px] uppercase px-2 py-1 rounded-full font-bold tracking-wider outline-none cursor-pointer text-center text-center-last transition-colors shadow-sm border border-transparent hover:border-gray-300">
                        <option value="Aberto" style="background-color: #E0F2FE; color: #0369A1;" ${os.situacao === 'Aberto' ? 'selected' : ''}>ABERTO</option>
                        <option value="Aguardando" style="background-color: #FEF3C7; color: #B45309;" ${os.situacao === 'Aguardando' ? 'selected' : ''}>AGUARDANDO</option>
                        <option value="Autorizado" style="background-color: #DCFCE7; color: #15803D;" ${os.situacao === 'Autorizado' ? 'selected' : ''}>AUTORIZADO</option>
                        <option value="Em Execução" style="background-color: #E0E7FF; color: #3730A3;" ${os.situacao === 'Em Execução' ? 'selected' : ''}>EM EXECUÇÃO</option>
                        <option value="Recusado" style="background-color: #FEE2E2; color: #B91C1C;" ${os.situacao === 'Recusado' ? 'selected' : ''}>RECUSADO</option>
                    </select>
                `;

                return `
                    <tr class="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors border-b border-gray-100 dark:border-gray-700">
                        <td class="p-4 font-mono font-bold text-gray-500 dark:text-gray-400">#${numeroFormatado}</td>
                        <td class="p-4 text-xs font-mono text-gray-600 dark:text-gray-400">${dataFormatada}</td>
                        
                        <!-- A PLACA: Texto azul claro no modo noturno para brilhar -->
                        <td class="p-4 font-black text-[#1a428a] dark:text-blue-400 tracking-wider text-lg whitespace-nowrap text-center">
                            <div class="relative inline-block">
                                ${iconeNotificacao}
                                <span>${placaFormatada}</span>
                            </div>
                        </td>
                        
                        <!-- CLIENTE/VEÍCULO: Texto branco no modo noturno para leitura perfeita -->
                        <td class="p-4 text-sm text-gray-700 dark:text-gray-300">
                            <p class="font-bold text-gray-800 dark:text-white">${clienteFormatado}</p>
                            <p class="text-xs text-gray-500 dark:text-gray-400 font-medium">${veiculoFormatado}</p>
                        </td>
                        
                        <!-- RESUMO FINANCEIRO: Fundo adaptável e valores com contraste -->
                        <td class="p-4 text-right text-sm border-l border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-transparent">
                            <p class="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">Itens: <span class="font-bold text-gray-800 dark:text-white">${qtdItens}</span></p>
                            <p class="font-black text-[#1a428a] dark:text-blue-400 tracking-wide">R$ ${valorTotalStr}</p>
                        </td>
                        
                        <td class="p-4 text-center appearance-none-wrapper relative">${selectStatus}</td>
                        
                        <td class="p-4">
                            <div class="flex flex-wrap justify-center items-center gap-2 dropdown-container">
                                <button onclick="window.visualizarOs(${os.id})" class="bg-gray-600 hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 text-white px-3 py-1.5 rounded font-bold text-xs shadow transition-colors">Detalhes</button>
                                <button onclick="window.editarOs(${os.id})" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded font-bold text-xs shadow transition-colors">Editar</button>
                                <button onclick="window.excluirOs(${os.id}, '${os.placa}', '${numeroFormatado}')" class="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded font-bold text-xs shadow transition-colors">Excluir</button>
                            </div>
                        </td>
                    </tr>
                `;
            } catch (rowErr) {
                console.error("Erro ao desenhar O.S ID:", os.id, rowErr);
                return `<tr><td colspan="7" class="text-center text-red-500 font-bold p-4 bg-red-50">Erro ao carregar O.S. #${os.id} (Dados Corrompidos)</td></tr>`;
            }
        }).join('');
    } catch (err) { 
        console.error("Erro Mestre ao listar:", err); 
        tabela.innerHTML = `<tr><td colspan="7" class="text-center p-8 text-red-500 font-bold">Erro de conexão: ${err.message || 'Falha ao buscar dados.'}</td></tr>`;
    }
};

window.visualizarNotificacaoLab = async function(osId, osNum, placa, situacao) {
    const confirmou = await window.abrirConfirmacao(
        "Atualização do Laboratório", 
        "O laboratório finalizou o serviço, atualizou o laudo ou inseriu evidências. Deseja visualizar?", 
        "aviso"
    );

    if (!confirmou) return;

    try {
        await supabase.from('ordens_servico').update({ lab_atualizado: false }).eq('id', osId);
        window.carregarOrdensServico(); 
        
        const btnLab = document.querySelector('.nav-btn[data-tela="lab"]');
        if (btnLab) btnLab.click();
        
        setTimeout(() => { 
            if (window.abrirGestaoPecas) {
                window.abrirGestaoPecas(osId, osNum, placa, situacao); 
            } else {
                window.mostrarToast("Erro: Painel do laboratório não carregado.", "erro");
            }
        }, 600);

    } catch (e) {
        console.error(e);
        window.mostrarToast("Erro ao processar notificação.", "erro");
    }
};

// ... O RESTANTE DO ORDEM.JS MANTÉM-SE INTACTO A PARTIR DAQUI ...
window.abrirModalNovaOs = function() {
    window.osEmEdicaoId = null;
    window.osNumeroAtual = null;
    window.itensOrcamento = [];
    window.modoLeitura = false;
    window.itemEmEdicaoId = null;
    document.getElementById('form-nova-os')?.reset();

    document.getElementById('outros-valores').value = '0,00';
    document.getElementById('desconto-valor').value = '0,00';
    document.getElementById('desconto-porcentagem').innerText = '0.00%';

    window.alternarModoLeitura(false);

    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('data_hora').value = now.toISOString().slice(0, 16);
    const sel = document.getElementById('situacao');
    if(sel) { sel.value = 'Aberto'; window.atualizarCorSelectSituacao(sel); }
    
    const btnAdd = document.querySelector('#painel-adicionar-item button');
    if (btnAdd) {
        btnAdd.innerHTML = '+';
        btnAdd.classList.remove('bg-amber-500', 'hover:bg-amber-600');
        btnAdd.classList.add('bg-[#1a428a]', 'hover:bg-blue-900');
    }

    document.getElementById('modal-os')?.classList.remove('hidden');
    document.getElementById('modal-os')?.classList.add('flex');
    window.configurarRastreioAlteracoes();
};

window.salvarOs = async function(event) {
    event.preventDefault();
    if(window.modoLeitura) return;

    const placa = window.formatarPlaca(document.getElementById('placa').value);
    if (!window.validarPlacaBrasil(placa)) {
        if (window.mostrarToast) window.mostrarToast("Placa inválida!", "erro");
        document.getElementById('placa').focus(); return;
    }
    if (window.itensOrcamento.length === 0) {
        if (window.mostrarToast) window.mostrarToast("Adicione pelo menos 1 item.", "aviso");
        return;
    }

    const tPecas = window.itensOrcamento.filter(i => i.tipo === 'Peça').reduce((acc, i) => acc + (Number(i.subtotal) || 0), 0);
    const tServ = window.itensOrcamento.filter(i => i.tipo === 'Serviço').reduce((acc, i) => acc + (Number(i.subtotal) || 0), 0);
    const valOutros = parseFloat(document.getElementById('outros-valores').value.replace(/\./g, '').replace(',', '.')) || 0;
    const valDesconto = parseFloat(document.getElementById('desconto-valor').value.replace(/\./g, '').replace(',', '.')) || 0;
    
    const calcTotalGeral = Math.max(0, tPecas + tServ + valOutros - valDesconto);

    const dadosOs = {
        data_hora: document.getElementById('data_hora').value,
        placa: placa, veiculo_placa: placa.replace('-', ''),
        modelo: document.getElementById('modelo').value.trim(), 
        marca: document.getElementById('marca').value.trim(),
        ano: document.getElementById('ano').value.trim(), 
        cpf_cnpj: document.getElementById('cpf_cnpj').value.trim(),
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
        desconto: valDesconto,
        total_geral: calcTotalGeral
    };

    try {
        let osId = null;
        if (window.osEmEdicaoId) {
            // BLINDAGEM 1: Exige resposta limpa na Atualização
            const { error: errUpdate } = await supabase.from('ordens_servico').update(dadosOs).eq('id', window.osEmEdicaoId);
            if (errUpdate) throw errUpdate;
            
            osId = window.osEmEdicaoId;
            
            // BLINDAGEM 2: Exige resposta limpa ao apagar os itens antigos
            const { error: errDelete } = await supabase.from('itens_orcamento').delete().eq('os_id', osId);
            if (errDelete) throw errDelete;
        } else {
            // BLINDAGEM 3: Exige resposta limpa na Criação
            const { data: nova, error: errInsert } = await supabase.from('ordens_servico').insert([dadosOs]).select().single();
            if (errInsert) throw errInsert;
            osId = nova.id;
        }

        if (window.itensOrcamento.length > 0) {
            const itensDB = window.itensOrcamento.map(i => ({
                os_id: osId,
                tipo: i.tipo,
                descricao: i.descricao,
                quantidade: i.qtd,
                valor_unitario: i.valorUnitario,
                subtotal: i.subtotal,
                concluido: i.concluido || false
            }));
            
            // BLINDAGEM 4: Exige resposta limpa ao inserir os novos itens
            const { error: errItens } = await supabase.from('itens_orcamento').insert(itensDB);
            if (errItens) throw errItens;
        }
        
        if (window.mostrarToast) window.mostrarToast("Ordem de Serviço salva!", "sucesso");
        window.fecharModalOsDireto();
        window.carregarOrdensServico();
    } catch (err) {
        // Agora o erro cai na malha de proteção e você consegue ver o motivo exato no F12 (Console)
        console.error("FALHA DE INTEGRIDADE NO BANCO:", err);
        if (window.mostrarToast) window.mostrarToast("Erro ao gravar O.S. (Veja o console para detalhes)", "erro");
    }
};

window.buscarDadosOs = async function(id) {
    const { data: os, error } = await supabase.from('ordens_servico').select('*').eq('id', id).single();
    if (error) throw error;

    window.osEmEdicaoId = os.id;
    window.osEmEdicaoNumero = os.numero_os || os.id;
    window.osNumeroAtual = os.numero_os || os.id;
    window.itemEmEdicaoId = null;

    document.getElementById('data_hora').value = os.data_hora ? os.data_hora.slice(0, 16) : '';
    document.getElementById('placa').value = window.formatarPlaca(os.placa);
    document.getElementById('modelo').value = (os.modelo || '').trim();
    document.getElementById('marca').value = (os.marca || '').trim();
    document.getElementById('ano').value = (os.ano || '').trim();
    document.getElementById('cpf_cnpj').value = (os.cpf_cnpj || '').trim();
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
    document.getElementById('desconto-valor').value = (os.desconto || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

    const sel = document.getElementById('situacao');
    if(sel) { sel.value = os.situacao || 'Aberto'; window.atualizarCorSelectSituacao(sel); }

    document.getElementById('defeito').value = (os.defeito || '').trim();

    const { data: itens } = await supabase.from('itens_orcamento').select('*').eq('os_id', id);
    window.itensOrcamento = itens ? itens.map(i => ({ id: i.id || Date.now(), tipo: i.tipo, descricao: i.descricao, qtd: i.quantidade, valorUnitario: i.valor_unitario, subtotal: i.subtotal, concluido: i.concluido })) : [];

    window.atualizarTituloModalOs(window.osNumeroAtual, os.placa);
    
    const btnAdd = document.querySelector('#painel-adicionar-item button');
    if (btnAdd) {
        btnAdd.innerHTML = '+';
        btnAdd.classList.remove('bg-amber-500', 'hover:bg-amber-600');
        btnAdd.classList.add('bg-[#1a428a]', 'hover:bg-blue-900');
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
    } catch (e) {}
};

window.visualizarOs = async function(id) {
    try { 
        window.modoLeitura = true; 
        await window.buscarDadosOs(id); 
        window.alternarModoLeitura(true); 
        
        document.getElementById('modal-os')?.classList.remove('hidden');
        document.getElementById('modal-os')?.classList.add('flex');
    } catch (e) {}
};

window.excluirOs = async function(id, placa, numeroOs) {
    const confirmou = await window.abrirConfirmacao("Excluir O.S.", `Deseja eliminar a O.S. #${numeroOs}?`, "perigo");
    if (!confirmou) return;
    try {
        await supabase.from('itens_orcamento').delete().eq('os_id', id);
        await supabase.from('ordens_servico').delete().eq('id', id);
        if (window.mostrarToast) window.mostrarToast("O.S. eliminada!", "sucesso");
        window.carregarOrdensServico();
    } catch (e) {
        if (window.mostrarToast) window.mostrarToast("Erro ao eliminar.", "erro");
    }
};

// =========================================================================
// 6. GESTÃO DE RASTREIO E ITENS 
// =========================================================================
window.configurarRastreioAlteracoes = function() {
    const form = document.getElementById('form-nova-os');
    if (!form) return;
    window.formAlterado = false;
    window.atualizarVisibilidadeBotoesFechamento();
    form.oninput = () => window.marcarComoAlterado();
    form.onchange = () => window.marcarComoAlterado();
};

window.marcarComoAlterado = function() {
    if (!window.formAlterado && !window.modoLeitura) {
        window.formAlterado = true;
        window.atualizarVisibilidadeBotoesFechamento();
    }
};

window.atualizarVisibilidadeBotoesFechamento = function() {
    const btnX = document.getElementById('btn-fechar-x');
    const btnCancelar = document.getElementById('btn-cancelar-alteracoes');
    if (!btnX || !btnCancelar) return;

    if (window.modoLeitura) {
        btnX.classList.remove('hidden');
        btnCancelar.classList.add('hidden');
        return;
    }

    if (window.formAlterado) {
        btnX.classList.add('hidden');
        btnCancelar.classList.remove('hidden');
    } else {
        btnX.classList.remove('hidden');
        btnCancelar.classList.add('hidden');
    }
};

window.fecharModalOsSeguro = async function() {
    if (window.formAlterado && !window.modoLeitura) {
        const confirmar = await window.abrirConfirmacao("Descartar", "Existem dados não salvos. Deseja fechar?", "aviso");
        if (!confirmar) return;
    }
    window.fecharModalOsDireto();
};

window.tentarCancelarOs = async function() {
    if (window.formAlterado) {
        const confirmar = await window.abrirConfirmacao("Cancelar", "Deseja descartar as alterações?", "perigo");
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

    const btnAdd = document.querySelector('#painel-adicionar-item button');
    if (btnAdd) {
        btnAdd.innerHTML = '💾';
        btnAdd.classList.remove('bg-[#1a428a]', 'hover:bg-blue-900');
        btnAdd.classList.add('bg-amber-500', 'hover:bg-amber-600');
    }
};

window.adicionarItemOrcamento = function() {
    if (window.modoLeitura) return;
    const tipo = document.getElementById('item-tipo').value;
    const desc = document.getElementById('item-descricao').value.trim();
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
        if (index !== -1) {
            window.itensOrcamento[index] = { 
                ...window.itensOrcamento[index], 
                tipo: tipo, 
                descricao: desc, 
                qtd: qtd, 
                valorUnitario: vNum, 
                subtotal: subtotal 
            };
        }
        window.itemEmEdicaoId = null;
        
        const btnAdd = document.querySelector('#painel-adicionar-item button');
        if (btnAdd) {
            btnAdd.innerHTML = '+';
            btnAdd.classList.remove('bg-amber-500', 'hover:bg-amber-600');
            btnAdd.classList.add('bg-[#1a428a]', 'hover:bg-blue-900');
        }

    } else {
        window.itensOrcamento.push({ id: Date.now(), tipo, descricao: desc, qtd, valorUnitario: vNum, subtotal: subtotal, concluido: false });
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
            <td class="p-3 text-right whitespace-nowrap">
                <button type="button" onclick="window.editarItemOrcamento(${item.id})" class="text-blue-500 hover:text-blue-700 mr-3 transition-colors" title="Editar">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                </button>
                <button type="button" onclick="window.removerItemOrcamento(${item.id})" class="text-red-500 font-black text-xl hover:text-red-700 transition-colors" title="Excluir">&times;</button>
            </td>`;
            
        return `
        <tr class="border-b border-gray-100 hover:bg-gray-50 transition-colors">
            <td class="p-3 text-center font-mono font-bold text-gray-400">${idx + 1}</td>
            <td class="p-3 text-center"><span class="px-2.5 py-1 text-[10px] uppercase rounded-full font-bold ${item.tipo === 'Peça' ? 'bg-purple-100 text-purple-800' : 'bg-amber-100 text-amber-800'}">${item.tipo}</span></td>
            <td class="p-3 font-bold text-gray-800 text-xs uppercase">${item.descricao}</td>
            <td class="p-3 text-center font-mono font-bold text-gray-700">${item.qtd}</td>
            <td class="p-3 text-right font-mono text-gray-600">${item.valorUnitario.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
            <td class="p-3 text-right font-mono font-bold text-[#1a428a]">${item.subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
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
    const txtDesconto = document.getElementById('desconto-valor')?.value || '0,00';
    
    const vOutros = parseFloat(txtOutros.replace(/\./g, '').replace(',', '.')) || 0;
    const vDesconto = parseFloat(txtDesconto.replace(/\./g, '').replace(',', '.')) || 0;

    const subtotalBruto = tPecas + tServ + vOutros; 
    
    let percentualDesconto = 0;
    if (subtotalBruto > 0 && vDesconto > 0) {
        percentualDesconto = (vDesconto / subtotalBruto) * 100;
    }
    
    const labelPorcentagem = document.getElementById('desconto-porcentagem');
    if (labelPorcentagem) {
        labelPorcentagem.innerText = percentualDesconto.toFixed(4) + '%';
    }

    const totalGeral = subtotalBruto - vDesconto;

    document.getElementById('qtd-total-itens').innerText = qtdTotal;
    document.getElementById('total-pecas').innerText = 'R$ ' + tPecas.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    document.getElementById('total-servicos').innerText = 'R$ ' + tServ.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    document.getElementById('total-geral').innerText = 'R$ ' + Math.max(0, totalGeral).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
};

// =========================================================================
// O.S. AVULSA / BALCÃO (Preenchimento Rápido com 1 clique)
// =========================================================================
window.preencherVeiculoAvulso = function() {
    const inputPlaca = document.getElementById('placa');
    const inputModelo = document.getElementById('modelo');
    const inputMarca = document.getElementById('marca');
    const inputAno = document.getElementById('ano');

    if (inputPlaca) {
        inputPlaca.value = '0000000';
        // Força o evento de input para o navegador entender a mudança e tirar o vermelho de campo "required" vazio
        inputPlaca.dispatchEvent(new Event('input')); 
    }
    
    if (inputModelo) {
        inputModelo.value = 'CONSUMIDOR / PEÇA AVULSA';
        inputModelo.dispatchEvent(new Event('input'));
    }
    
    if (inputMarca) {
        inputMarca.value = 'N/A';
        inputMarca.dispatchEvent(new Event('input'));
    }
    
    if (inputAno) {
        inputAno.value = '0000';
        inputAno.dispatchEvent(new Event('input'));
    }

    if(window.mostrarToast) window.mostrarToast("Modo O.S. Avulsa ativado!", "info");
};
