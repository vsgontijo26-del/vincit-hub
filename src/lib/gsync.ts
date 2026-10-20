/** envio ao Google Agenda a partir do navegador; silencioso quando o Google não está conectado */
const post = (body: any) => fetch("/api/google/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json()).catch(() => null);

/** chame depois de criar ou editar uma tarefa (prazo, título, conclusão): cria, atualiza ou remove o evento no Google */
export const syncTask = (id: string) => post({ task_id: id });
/** chame antes ou depois de excluir uma tarefa */
export const unsyncTask = (id: string) => post({ delete_task: id });
