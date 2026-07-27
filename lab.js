// JS/modules/lab.js
import { supabase } from './config.js';

window.osIdAtualLab = null;
window.pecasLabAtual = [];
window.itemLabEmEdicaoId = null;
window.itemObsEmEdicaoId = null;
window.evidenciasAtuais = [];
window.laudoAtualUrl = null;

// Máscara Universal Blindada
window.formatarPlaca = function(placa) {
    try {
        if (!placa) return '---';
        let p = String(placa).toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (/^[A-Z]{3}[0-9]{4}$/.test(p)) return p.substring(0, 3) + '-' + p.substring(3, 7);
        return p || '---';
    } catch(e) { return '---'; }
};

// =========================================================================
// 1. CARREGAR LABORATÓRIO (TELA PRINCIPAL)
// =========================================================================
window.carregarLaboratorio = async function() {
    const tabelaLab = document.getElementById('tabela-lab');
    if (!tabelaLab) return;
    
    tabelaLab.innerHTML = '<tr><td colspan="7" class="text-center p-6 text-gray-500 dark:text-gray-400 font-bold transition-colors">Buscando painel do laboratório...</td></tr>';

    try {
        const { data, error } = await supabase.from('ordens_servico').select('*, pecas_lab(*)').neq('situacao', 'Recusado').order('id', { ascending: false });
        if (error) throw error;
        
        if (data.length === 0) { 
            tabelaLab.innerHTML = '<tr><td colspan="7" class="text-center p-6 text-gray-500 dark:text-gray-400 font-bold transition-colors">Nenhum serviço pendente no laboratório.</td></tr>'; 
            return; 
        }

        tabelaLab.innerHTML = data.map(os => {
            try {
                const numeroFormatado = String(os.numero_os || os.id).padStart(4, '0');
                const placaFormatada = window.formatarPlaca(os.placa);
                
                // MÁGICA DA FORMATAÇÃO DO VEÍCULO E CLIENTE
                const clienteFormatado = String(os.cliente || '---').trim().toUpperCase();
                const modeloUpper = String(os.modelo || '---').trim().toUpperCase();
                const anoStr = String(os.ano || '').trim();
                const veiculoFormatado = anoStr ? `${modeloUpper} - ${anoStr}` : modeloUpper;
                
                const totalPecas = os.pecas_lab ? os.pecas_lab.reduce((a, b) => a + (b.quantidade || 1), 0) : 0;
                const infoPecas = `<p class="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">Itens: <span class="font-black text-gray-900 dark:text-white">${totalPecas}</span></p>`;
                
                const badgeLaudo = os.laudo_pdf_url 
                    ? `<a href="${os.laudo_pdf_url}" target="_blank" class="bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800 dark:hover:bg-green-900/40 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider inline-flex items-center gap-1 transition-colors shadow-sm" title="Abrir Laudo em PDF"><svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> Laudo Anexado</a>` 
                    : ``;

                let bgStatus = 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
                if (os.situacao === 'Aberto') bgStatus = 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400 border border-transparent dark:border-sky-800';
                else if (os.situacao === 'Aguardando') bgStatus = 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border border-transparent dark:border-amber-800';
                else if (os.situacao === 'Autorizado') bgStatus = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400 border border-transparent dark:border-emerald-800';
                else if (os.situacao === 'Em Execução') bgStatus = 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400 border border-transparent dark:border-indigo-800';

                let botoesHtml = `
                    <button onclick="window.abrirGestaoPecas(${os.id}, ${os.numero_os || os.id}, '${os.placa}', '${os.situacao}')" class="whitespace-nowrap bg-[#1a428a] dark:bg-blue-600 text-white px-3 py-1.5 rounded font-bold text-xs hover:bg-blue-900 dark:hover:bg-blue-500 transition-colors shadow-sm">
                        Acessar Painel
                    </button>
                `;
                if (os.situacao === 'Autorizado') {
                    botoesHtml += `
                        <button onclick="window.finalizarServicoLabDaLista(${os.id})" class="whitespace-nowrap bg-emerald-600 dark:bg-emerald-500 text-white px-3 py-1.5 rounded font-bold text-xs hover:bg-emerald-700 dark:hover:bg-emerald-400 transition-colors shadow-sm">
                            Serviço Pronto
                        </button>
                    `;
                }

                return `
                    <tr class="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors border-b border-gray-100 dark:border-gray-700">
                        <td class="p-4 font-mono font-bold text-gray-500 dark:text-gray-400">#${numeroFormatado}</td>
                        <td class="p-4 font-black text-[#1a428a] dark:text-blue-400 tracking-wider text-lg whitespace-nowrap">${placaFormatada}</td>
                        <td class="p-4 text-sm text-gray-700 dark:text-gray-300">
                            <p class="font-bold text-gray-800 dark:text-white">${clienteFormatado}</p>
                            <p class="text-xs text-gray-500 dark:text-gray-400 font-medium">${veiculoFormatado}</p>
                        </td>
                        <td class="p-4 text-sm text-gray-600 dark:text-gray-400">
                            <p class="font-semibold text-gray-800 dark:text-gray-200 line-clamp-2">${String(os.defeito || 'Nenhum defeito relatado')}</p>
                        </td>
                        <td class="p-4 border-l border-gray-100 dark:border-gray-700 bg-gray-50/30 dark:bg-transparent">
                            <div class="flex flex-col items-start">
                                ${infoPecas}
                                ${badgeLaudo}
                            </div>
                        </td>
                        <td class="p-4 text-center">
                            <span class="${bgStatus} text-[10px] uppercase px-3 py-1.5 rounded-full font-bold tracking-wider shadow-sm transition-colors">${os.situacao || 'Aberto'}</span>
                        </td>
                        <td class="p-4">
                            <div class="flex items-center justify-center gap-2">
                                ${botoesHtml}
                            </div>
                        </td>
                    </tr>
                `;
            } catch(rowErr) {
                return `<tr><td colspan="7" class="text-center text-red-500 dark:text-red-400 font-bold p-4">Erro O.S. #${os.id}</td></tr>`;
            }
        }).join('');

    } catch (err) { 
        console.error("Erro ao carregar laboratório:", err); 
        tabelaLab.innerHTML = `<tr><td colspan="7" class="text-center p-6 text-red-500 dark:text-red-400 font-bold transition-colors">Erro: ${err.message || 'Falha de comunicação'}</td></tr>`;
    }
};

window.finalizarServicoLabDaLista = async function(osId) {
    const confirmou = await window.abrirConfirmacao("Serviço Pronto", "Isto alertará a recepção de que os testes e laudos desta O.S. foram finalizados. Continuar?", "aviso");
    if (!confirmou) return;
    try {
        await supabase.from('ordens_servico').update({ lab_atualizado: true }).eq('id', osId);
        window.mostrarToast("Serviço Concluído! O.S. notificada.", "sucesso");
    } catch (e) { console.error(e); window.mostrarToast("Erro ao notificar.", "erro"); }
};

// =========================================================================
// 2. MODAL PRINCIPAL & ARQUIVOS GERAIS
// =========================================================================
window.abrirGestaoPecas = async function (osId, numeroOs, placa, situacao) {
    window.osIdAtualLab = osId;
    window.itemLabEmEdicaoId = null;
    const numeroFormatado = String(numeroOs).padStart(4, '0');
    
    document.getElementById('pecas-os-titulo').innerHTML = `OS #${numeroFormatado} <span class="font-light">(${window.formatarPlaca(placa)})</span>`;

    const btnPronto = document.getElementById('btn-servico-pronto');
    if (btnPronto) {
        if (situacao === 'Autorizado') btnPronto.classList.remove('hidden');
        else btnPronto.classList.add('hidden');
    }

    const { data: osData } = await supabase.from('ordens_servico').select('lab_observacao, laudo_pdf_url, lab_evidencias').eq('id', osId).single();
    
    document.getElementById('input-obs-lab').value = osData?.lab_observacao || '';
    window.laudoAtualUrl = osData?.laudo_pdf_url || null;
    window.evidenciasAtuais = osData?.lab_evidencias || [];

    window.renderizarArquivosLab();

    const modal = document.getElementById('modal-pecas');
    if (modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }
    
    await window.carregarPecasDaOs(osId, true);
};

window.fecharModalPecas = function() {
    document.getElementById('modal-pecas')?.classList.add('hidden');
    document.getElementById('modal-pecas')?.classList.remove('flex');
};

window.renderizarArquivosLab = function() {
    const badgeLaudo = document.getElementById('badge-laudo');
    const acoesLaudo = document.getElementById('acoes-laudo');
    if (window.laudoAtualUrl) {
        badgeLaudo.innerText = 'ANEXADO';
        badgeLaudo.className = 'text-[9px] bg-green-500 text-white px-2 py-0.5 rounded font-bold uppercase tracking-wider shadow-sm';
        acoesLaudo.innerHTML = `
            <a href="${window.laudoAtualUrl}" target="_blank" class="flex-1 bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 text-xs font-bold py-1.5 rounded text-center transition-colors">Abrir PDF</a>
            <button type="button" onclick="window.removerLaudo()" class="bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded transition-colors border border-red-200 flex items-center justify-center" title="Remover Laudo">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
        `;
    } else {
        badgeLaudo.innerText = 'Pendente';
        badgeLaudo.className = 'text-[9px] bg-gray-200 text-gray-600 px-2 py-0.5 rounded font-bold uppercase tracking-wider';
        acoesLaudo.innerHTML = `
            <label class="flex-1 cursor-pointer bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 text-xs font-bold py-1.5 rounded text-center transition-colors">
                Anexar <input type="file" class="hidden" accept="application/pdf" onchange="window.anexarArquivoGeralLab(this, 'laudo')">
            </label>
        `;
    }

    const badgeEvid = document.getElementById('badge-evidencia');
    const btnVerEvid = document.getElementById('btn-ver-evidencias');
    if (window.evidenciasAtuais.length > 0) {
        badgeEvid.innerText = `${window.evidenciasAtuais.length} ARQUIVO(S)`;
        badgeEvid.className = 'text-[9px] bg-blue-500 text-white px-2 py-0.5 rounded font-bold uppercase tracking-wider shadow-sm';
        btnVerEvid.classList.remove('hidden');
    } else {
        badgeEvid.innerText = 'Pendente';
        badgeEvid.className = 'text-[9px] bg-gray-200 text-gray-600 px-2 py-0.5 rounded font-bold uppercase tracking-wider';
        btnVerEvid.classList.add('hidden');
    }
};

window.salvarDadosLaboratorio = async function() {
    if (!window.osIdAtualLab) return;
    const obs = document.getElementById('input-obs-lab').value.trim();
    if (window.mostrarToast) window.mostrarToast("A gravar...", "aviso");
    try {
        await supabase.from('ordens_servico').update({ lab_observacao: obs, lab_atualizado: true }).eq('id', window.osIdAtualLab);
        if (window.mostrarToast) window.mostrarToast("Dados Guardados!", "sucesso");
    } catch (e) { console.error(e); }
};

window.anexarArquivoGeralLab = async function(inputEl, tipo) {
    if (!window.osIdAtualLab) return;
    const arquivos = inputEl.files;
    if (arquivos.length === 0) return;
    
    window.mostrarToast(`⏳ Subindo arquivo(s)...`, "aviso");
    try {
        for (let arquivo of arquivos) {
            const ext = arquivo.name.split('.').pop();
            const nomeArquivo = `${tipo}_os_${window.osIdAtualLab}_${Date.now()}_${Math.floor(Math.random()*1000)}.${ext}`;
            const { error: storageError } = await supabase.storage.from('lab-docs').upload(nomeArquivo, arquivo);
            if (storageError) throw storageError;
            
            const publicUrl = supabase.storage.from('lab-docs').getPublicUrl(nomeArquivo).data.publicUrl;
            
            if (tipo === 'laudo') {
                window.laudoAtualUrl = publicUrl;
                await supabase.from('ordens_servico').update({ laudo_pdf_url: publicUrl, lab_atualizado: true }).eq('id', window.osIdAtualLab);
            } else if (tipo === 'evidencia') {
                window.evidenciasAtuais.push(publicUrl);
            }
        }
        
        if (tipo === 'evidencia') {
            await supabase.from('ordens_servico').update({ lab_evidencias: window.evidenciasAtuais, lab_atualizado: true }).eq('id', window.osIdAtualLab);
            window.renderizarModalEvidencias();
        }
        
        window.mostrarToast(`✅ Upload concluído!`, "sucesso");
        inputEl.value = ''; 
        window.renderizarArquivosLab();
    } catch (err) { 
        console.error(err); 
        window.mostrarToast(`Erro no upload.`, "erro"); 
    }
};

window.removerLaudo = async function() {
    try {
        window.laudoAtualUrl = null;
        await supabase.from('ordens_servico').update({ laudo_pdf_url: null, lab_atualizado: true }).eq('id', window.osIdAtualLab);
        window.renderizarArquivosLab();
    } catch(e){}
};

// =========================================================================
// 3. GALERIA DE EVIDÊNCIAS
// =========================================================================
window.abrirModalEvidencias = function() {
    window.renderizarModalEvidencias();
    document.getElementById('modal-evidencias').classList.remove('hidden');
    document.getElementById('modal-evidencias').classList.add('flex');
};

window.fecharModalEvidencias = function() {
    document.getElementById('modal-evidencias')?.classList.add('hidden');
    document.getElementById('modal-evidencias')?.classList.remove('flex');
};

window.renderizarModalEvidencias = function() {
    const grid = document.getElementById('grid-evidencias');
    if(!grid) return;
    
    if (window.evidenciasAtuais.length === 0) {
        grid.innerHTML = '<div class="col-span-full text-center text-gray-500 py-10 font-bold">Nenhuma evidência anexada.</div>';
        return;
    }

    grid.innerHTML = window.evidenciasAtuais.map((url, index) => {
        if(!url) return '';
        const isVideo = String(url).match(/\.(mp4|webm|ogg|mov)$/i);
        const mediaHtml = isVideo 
            ? `<video src="${url}" controls class="w-full h-40 object-cover rounded-lg bg-black shadow-sm"></video>`
            : `<a href="${url}" target="_blank"><img src="${url}" class="w-full h-40 object-cover rounded-lg border border-gray-300 hover:opacity-80 transition-opacity shadow-sm"></a>`;
        return `
            <div class="relative group">
                ${mediaHtml}
                <button onclick="window.removerEvidencia(${index})" class="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white rounded p-1.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-md" title="Excluir Evidência">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
            </div>
        `;
    }).join('');
};

window.removerEvidencia = async function(index) {
    if(!await window.abrirConfirmacao("Remover Evidência", "Tem certeza que deseja apagar este arquivo?", "perigo")) return;
    
    window.evidenciasAtuais.splice(index, 1);
    try {
        await supabase.from('ordens_servico').update({ lab_evidencias: window.evidenciasAtuais, lab_atualizado: true }).eq('id', window.osIdAtualLab);
        window.renderizarArquivosLab();
        window.renderizarModalEvidencias();
        if(window.evidenciasAtuais.length === 0) window.fecharModalEvidencias();
    } catch(e) { console.error(e); }
};

// =========================================================================
// 4. TABELA DE PEÇAS 
// =========================================================================
window.carregarPecasDaOs = async function(osId, primeiraCarga = false) {
    const tbody = document.getElementById('tabela-pecas-os');
    const spanTotal = document.getElementById('total-pecas-os');
    if (!tbody) return;

    if (primeiraCarga) tbody.innerHTML = '<tr><td colspan="4" class="text-center p-6 text-gray-400 font-bold">Puxando dados...</td></tr>';

    try {
        const { data, error } = await supabase.from('pecas_lab').select('*').eq('os_id', osId).order('id', { ascending: true });
        if (error) throw error;

        window.pecasLabAtual = data || [];

        if (window.pecasLabAtual.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center p-6 text-gray-400 italic">Nenhum item adicionado.</td></tr>';
            if(spanTotal) spanTotal.innerText = '0';
            return;
        }

        let totalQuantidade = 0;
        tbody.innerHTML = window.pecasLabAtual.map((item, index) => {
            totalQuantidade += (item.quantidade || 1);
            
            const temObs = item.observacao && item.observacao.trim() !== '';
            const iconeCor = temObs ? 'text-blue-600 hover:text-blue-800' : 'text-gray-400 hover:text-blue-500';
            const iconeSvg = temObs 
                ? `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 inline-block drop-shadow-sm" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clip-rule="evenodd" /></svg>` 
                : `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>`;

            return `
                <tr class="hover:bg-gray-50 transition-colors border-b border-gray-100">
                    <td class="p-3 text-center font-bold text-gray-400 font-mono">${index + 1}</td>
                    <td class="p-3 font-bold text-gray-700 uppercase text-xs tracking-wide">${item.descricao}</td>
                    <td class="p-3 text-center font-black text-[#1a428a] text-base">${item.quantidade || 1}</td>
                    <td class="p-3 text-center whitespace-nowrap">
                        <button type="button" onclick="window.editarPecaLab(${item.id})" class="text-blue-500 hover:text-blue-700 mr-4 transition-colors" title="Editar Item">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </button>
                        <button type="button" onclick="window.abrirObsItemLab(${item.id})" class="${iconeCor} mr-4 transition-colors" title="Anotações do Item">
                            ${iconeSvg}
                        </button>
                        <button type="button" onclick="window.removerPecaOs(${item.id})" class="text-red-400 hover:text-red-600 font-black text-xl transition-colors" title="Excluir Item">&times;</button>
                    </td>
                </tr>
            `;
        }).join('');
        
        if(spanTotal) spanTotal.innerText = totalQuantidade;

    } catch (err) { console.error(err); }
};

window.editarPecaLab = function(id) {
    const item = window.pecasLabAtual.find(i => i.id === id);
    if (!item) return;
    document.getElementById('input-nome-peca').value = item.descricao;
    document.getElementById('input-qtd-peca').value = item.quantidade;
    window.itemLabEmEdicaoId = id;
    const btn = document.getElementById('btn-add-peca');
    if (btn) {
        btn.innerHTML = 'Salvar Edição';
        btn.className = 'w-full bg-amber-500 hover:bg-amber-600 text-white font-bold px-6 py-2 rounded-lg text-sm shadow transition-colors';
    }
};

window.salvarPecaLab = async function () {
    if (!window.osIdAtualLab) return;
    const inputNome = document.getElementById('input-nome-peca');
    const inputQtd = document.getElementById('input-qtd-peca');
    const descricao = inputNome.value.trim();
    const quantidade = parseInt(inputQtd.value) || 1;

    if (!descricao) { inputNome.focus(); return; }

    try {
        if (window.itemLabEmEdicaoId) {
            await supabase.from('pecas_lab').update({ descricao, quantidade }).eq('id', window.itemLabEmEdicaoId);
            window.itemLabEmEdicaoId = null;
            const btn = document.getElementById('btn-add-peca');
            if(btn) {
                btn.innerHTML = 'Adicionar';
                btn.className = 'w-full bg-[#1a428a] hover:bg-blue-900 text-white font-bold px-6 py-2 rounded-lg text-sm shadow transition-colors';
            }
        } else {
            await supabase.from('pecas_lab').insert([{ os_id: window.osIdAtualLab, descricao, quantidade }]);
        }
        await supabase.from('ordens_servico').update({ lab_atualizado: true }).eq('id', window.osIdAtualLab);
        inputNome.value = ''; inputQtd.value = '1'; inputNome.focus();
        window.carregarPecasDaOs(window.osIdAtualLab, false);
    } catch (err) { console.error(err); window.mostrarToast("Falha ao salvar peça.", "erro"); }
};

window.verificarEnterPeca = function (event) { if (event.key === 'Enter') window.salvarPecaLab(); };

window.removerPecaOs = async function (itemId) {
    const confirmou = await window.abrirConfirmacao("Excluir", "Remover este item da lista?", "perigo");
    if (!confirmou) return;
    try {
        await supabase.from('pecas_lab').delete().eq('id', itemId);
        await supabase.from('ordens_servico').update({ lab_atualizado: true }).eq('id', window.osIdAtualLab);
        window.carregarPecasDaOs(window.osIdAtualLab, false);
    } catch (err) { console.error(err); }
};

// =========================================================================
// 5. OBSERVAÇÕES E FOTO INDIVIDUAL DA PEÇA
// =========================================================================
window.abrirObsItemLab = function(itemId) {
    const item = window.pecasLabAtual.find(i => i.id === itemId);
    if(!item) return;

    window.itemObsEmEdicaoId = itemId;
    document.getElementById('nome-peca-obs').innerText = item.descricao;
    document.getElementById('input-obs-item').value = item.observacao || '';

    const boxFoto = document.getElementById('box-foto-peca');
    if (boxFoto) {
        if (item.foto_url) {
            boxFoto.innerHTML = `
                <a href="${item.foto_url}" target="_blank"><img src="${item.foto_url}" class="w-full h-32 object-cover rounded border border-gray-300 mb-2 shadow-sm"></a>
                <div class="flex gap-2">
                    <label class="flex-1 cursor-pointer bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 text-xs font-bold py-1.5 rounded text-center transition-colors">
                        Trocar Foto <input type="file" class="hidden" accept="image/*" onchange="window.enviarFotoUnicaPeca(this)">
                    </label>
                    <button type="button" onclick="window.removerFotoUnicaPeca()" class="bg-red-50 text-red-500 border border-red-200 hover:bg-red-100 px-3 rounded font-bold transition-colors">✖</button>
                </div>
            `;
        } else {
            boxFoto.innerHTML = `
                <label class="cursor-pointer bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 text-xs font-bold py-2 rounded transition-colors block w-full text-center">
                    📷 Anexar Foto da Peça
                    <input type="file" class="hidden" accept="image/*" onchange="window.enviarFotoUnicaPeca(this)">
                </label>
            `;
        }
    }

    const modal = document.getElementById('modal-obs-peca');
    if(modal) {
        modal.classList.remove('hidden'); 
        modal.classList.add('flex');
    }
};

window.fecharModalObs = function() {
    document.getElementById('modal-obs-peca')?.classList.add('hidden');
    document.getElementById('modal-obs-peca')?.classList.remove('flex');
};

window.salvarObsItemLab = async function() {
    if (!window.itemObsEmEdicaoId) return;
    const obs = document.getElementById('input-obs-item').value.trim();

    try {
        await supabase.from('pecas_lab').update({ observacao: obs }).eq('id', window.itemObsEmEdicaoId);
        await supabase.from('ordens_servico').update({ lab_atualizado: true }).eq('id', window.osIdAtualLab);
        
        window.fecharModalObs();
        window.mostrarToast("Dados atualizados!", "sucesso");
        window.carregarPecasDaOs(window.osIdAtualLab, false);
    } catch(e) { console.error(e); }
};

window.enviarFotoUnicaPeca = async function(inputEl) {
    if (!window.itemObsEmEdicaoId) return;
    const arquivo = inputEl.files[0];
    if (!arquivo) return;

    document.getElementById('box-foto-peca').innerHTML = '<p class="text-xs text-[#1a428a] font-bold text-center">⏳ A subir imagem...</p>';

    try {
        const ext = arquivo.name.split('.').pop();
        const nomeArquivo = `foto_item_${window.itemObsEmEdicaoId}_${Date.now()}.${ext}`;
        const { error: storageError } = await supabase.storage.from('lab-docs').upload(nomeArquivo, arquivo);
        if (storageError) throw storageError;

        const publicUrl = supabase.storage.from('lab-docs').getPublicUrl(nomeArquivo).data.publicUrl;
        
        await supabase.from('pecas_lab').update({ foto_url: publicUrl }).eq('id', window.itemObsEmEdicaoId);
        await supabase.from('ordens_servico').update({ lab_atualizado: true }).eq('id', window.osIdAtualLab);
        
        const item = window.pecasLabAtual.find(i => i.id === window.itemObsEmEdicaoId);
        if(item) item.foto_url = publicUrl;

        window.abrirObsItemLab(window.itemObsEmEdicaoId); 
        window.carregarPecasDaOs(window.osIdAtualLab, false); 
    } catch(e) { 
        console.error(e); 
        window.mostrarToast("Erro ao gravar foto.", "erro"); 
    }
};

window.removerFotoUnicaPeca = async function() {
    if (!window.itemObsEmEdicaoId) return;
    try {
        await supabase.from('pecas_lab').update({ foto_url: null }).eq('id', window.itemObsEmEdicaoId);
        await supabase.from('ordens_servico').update({ lab_atualizado: true }).eq('id', window.osIdAtualLab);
        
        const item = window.pecasLabAtual.find(i => i.id === window.itemObsEmEdicaoId);
        if(item) item.foto_url = null;
        
        window.abrirObsItemLab(window.itemObsEmEdicaoId);
        window.carregarPecasDaOs(window.osIdAtualLab, false);
    } catch(e) { console.error(e); }
};

// =========================================================================
// 6. SERVIÇO PRONTO
// =========================================================================
window.finalizarServicoLab = async function() {
    if (!window.osIdAtualLab) return;
    const confirmou = await window.abrirConfirmacao("Serviço Pronto", "Isto alertará a recepção de que os testes e laudos foram finalizados.", "aviso");
    if (!confirmou) return;

    try {
        await supabase.from('ordens_servico').update({ lab_atualizado: true }).eq('id', window.osIdAtualLab);
        window.mostrarToast("✅ Serviço Concluído! O.S. notificada.", "sucesso");
        window.fecharModalPecas();
    } catch (e) { console.error(e); }
};
