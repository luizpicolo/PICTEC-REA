const formulario = document.getElementById("formulario-envio");
const botao = document.getElementById("botao-enviar");
const status = document.getElementById("status");
const resultado = document.getElementById("resultado");

function mostrarStatus(mensagem, tipo) {
  status.textContent = mensagem;
  status.className = `status show ${tipo}`;
}

formulario.addEventListener("submit", async (event) => {
  event.preventDefault();

  const arquivo = document.getElementById("arquivo").files[0];
  if (!arquivo) {
    mostrarStatus("Selecione um arquivo para continuar.", "error");
    return;
  }

  const dados = new FormData(formulario);
  botao.disabled = true;
  botao.textContent = "Enviando...";
  resultado.hidden = true;
  mostrarStatus("Processando o arquivo e criando o registro. Isso pode levar alguns segundos.", "loading");

  try {
    const resposta = await fetch("/api/obras", {
      method: "POST",
      body: dados
    });

    const texto = await resposta.text();
    let retorno;
    try { retorno = JSON.parse(texto); } catch { retorno = { erro: texto }; }

    if (!resposta.ok) {
      throw new Error(retorno.erro || "Não foi possível enviar a obra.");
    }

    mostrarStatus("Obra enviada e registrada com sucesso!", "success");
    resultado.hidden = false;
    resultado.innerHTML = `
      <strong>Registro criado</strong>
      <div>ID: ${retorno.id ?? "—"}</div>
      <div>CID: ${retorno.cid ?? "—"}</div>
      <div>SHA-256: ${retorno.sha256 ?? "—"}</div>
      <div>Versão: ${retorno.versao ?? "—"}</div>
    `;
    formulario.reset();
    document.getElementById("versao").value = "1.0.0";
  } catch (erro) {
    console.error(erro);
    mostrarStatus(`Erro ao enviar a obra: ${erro.message}`, "error");
  } finally {
    botao.disabled = false;
    botao.textContent = "Enviar obra";
  }
});
