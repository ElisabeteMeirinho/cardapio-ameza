# AMEZA — configuração Firebase

## Projeto separado
Crie um projeto novo no Firebase Console, exclusivo para a AMEZA. Não reutilize o projeto `inclusao-alimentar`.

## Configuração Web
1. Registre um aplicativo Web no projeto AMEZA.
2. Copie os valores públicos de configuração para `config.js`.
3. Habilite Authentication com e-mail e senha.
4. Crie o Firestore Database.
5. Revise `firestore.rules` antes de publicar as regras.
6. Em Authentication > Settings > Authorized domains, confirme que `elisabetemeirinho.github.io` está na lista (é o domínio usado pelo GitHub Pages). Se a AMEZA passar a usar um domínio próprio, adicione também apenas o domínio configurado e validado no DNS.

## Conta administradora
1. Crie e confirme uma conta pelo fluxo de estabelecimento.
2. Copie o UID no Authentication.
3. No Firestore, crie `platformAdmins/{UID}` com `enabled: true`.
4. Nunca permita que o site público crie ou altere esses documentos.

## Segurança e dados
- Não cadastrar consumidores nem armazenar preferências ou restrições pessoais.
- CNPJ, contato do responsável e evidências de parceria ficam privados.
- Nome comercial e WhatsApp comercial são públicos apenas após aprovação.
- Não publique regras sem conferir que o Console aberto corresponde ao projeto AMEZA.
- Faça testes com contas e dados fictícios antes de convidar estabelecimentos.

## Atenção
Os filtros exibem declarações do estabelecimento; não certificam ausência de alergênicos, contato cruzado ou segurança para doença celíaca. A plataforma não valida CNPJ nem procedimentos de cozinha.
