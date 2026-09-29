# Terapia para Todos — protótipo local do CRM

Abra `index.html` no navegador do notebook. Não é necessário instalar nada.

Esta versão permite testar, com **dados fictícios**, parceiro, pacote, oportunidade, encaminhamento, redirecionamento, reposição, saldos e histórico. Inclui campos de telefone, turno e motivo da oportunidade, além de abordagem, demandas, turnos e status do parceiro. A sugestão preliminar de parceiro compara palavras do motivo com demandas informadas, além de turno, status ativo e saldo. **Não é triagem clínica nem encaminhamento automático**; Igor confirma a escolha. Os dados ficam somente no navegador em que o arquivo foi aberto. Use **Exportar JSON** para guardar uma cópia de teste; limpar dados do navegador pode apagá-los.

**Não cadastre dados reais de pessoas nesta versão.** Ela ainda não tem login, banco de dados, cópias automáticas ou controle de acesso. O próximo passo é migrar as regras validadas para Next.js + Supabase e publicar com Vercel.

Roteiro rápido de teste:

1. Cadastre dois parceiros e um pacote de 7 para o primeiro.
2. Cadastre uma oportunidade fictícia e encaminhe ao primeiro parceiro. O pacote deve mostrar 1 entrega e 6 pendentes.
3. Crie um pacote para o segundo parceiro e redirecione a oportunidade com motivo. O primeiro volta a 0 entrega; o segundo passa a 1. O histórico mantém os dois encaminhamentos.
4. Para testar reposição, crie **outra** oportunidade e encaminhe a um pacote com saldo. Selecione essa entrega original no formulário de reposição e registre um motivo fictício. A obrigação adicional aparece sem apagar a entrega. A oportunidade já redirecionada não pode gerar uma reposição para o parceiro cujo encaminhamento foi estornado.

Para testar a sugestão, atualize o perfil de um parceiro existente, marque-o ativo, informe turno e demandas como `ansiedade, luto`. Cadastre uma oportunidade fictícia com a palavra `ansiedade` no motivo e selecione-a em **Sugestão preliminar de parceiro**. A sugestão só aparece se houver pacote com saldo e turno compatível. Motivos sem palavras reconhecidas exigem triagem manual.

O protótipo não envia mensagens, não decide automaticamente se uma reposição é devida e não sincroniza com o projeto Supabase já criado.
