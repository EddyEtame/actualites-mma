# PRISE MMA (actu-mma.com) — état du 12 octobre 2026

## 12 octobre 2026 — édition automatique réparée

- **Cause des échecs #12 à #19** (GitHub Actions, depuis le créneau du 10 octobre 18 h UTC) : le secret `OPENAI_API_KEY` n'a jamais été créé ; l'étape d'édition s'arrêtait en 0 s sur `WRITER_NOT_CONFIGURED`. Les exécutions #1 à #11 étaient vertes uniquement parce qu'aucune édition n'était due.
- **Deuxième cause, masquée par la première** : avec la clé et `gpt-6-luna`, l'ancien code aurait échoué quand même (1 article retenu sur 12). Les corps ActuMMA et La Sueur contenaient 50 à 118 entités HTML non décodées par article (`&eacute;`, `&agrave;`, `&laquo;`…) ; selon que le modèle recopiait ou non ces entités, ses passages de preuve « n'existaient pas » dans la source. Le décodeur couvre maintenant tout Latin-1 et la typographie ; la preuve est comparée après normalisation (apostrophes, guillemets, espaces insécables, retours à la ligne, casse).
- Autres corrections du pipeline : comptage de mots qui ignore la ponctuation française espacée ; une révision quand un défaut est réparable, puis nouvelle vérification ; photo qualifiée avant toute rédaction (une photo inutilisable écarte un sujet, plus l'édition) ; erreurs fournisseur temporaires réessayées, clé/quota refusés en arrêt immédiat ; budgets de sortie 12 000/8 000 jetons ; modèle par défaut versionné (`writerModel`) ; édition incomplète « en attente » 24 h avant alarme ; résumé d'exécution ; actions GitHub v7 (Node 24) épinglées par SHA ; runner `ubuntu-24.04` ; deux réveils par heure ; push protégé contre un rebase en conflit.
- **Preuve** : édition complète exécutée dans un clone jetable, avec la vraie clé et `gpt-6-luna`, sans variable de modèle : 16 sujets frais, 7 rédigés, 6 retenus (le 7e, doublon Goddard, rejeté à juste titre), 18 appels, publication locale, validation, build de 42 pages et audit passés. Rien n'a été publié en ligne depuis ce clone. 42 tests passent (29 avant).
- **Site** : origine unique `https://www.actu-mma.com` (le domaine nu redirige en 308 ; canoniques, sitemap, RSS, llms.txt et cartes pointaient vers une URL redirigée) ; plus de « Dernière édition · nouvelles en attente » ni d'« Archive » sur la une ; titre principal toujours présent ; extrait complet ; « 9 portraits, cinq organisations » (faux : deux) calculé depuis les données ; boutons qui promettaient « chroniques » et « annuaire complet » corrigés ; soirées passées retirées de « À venir » au chargement ; dates en minuscules françaises ; titres longs sans suffixe de marque ; descriptions coupées en fin de phrase ; signature des articles alignée sur la marque affichée (`Rédaction PRISE MMA`), le nom du média source étant transmis tel quel au rédacteur pour ne plus écrire « Actu MMA » à la place d'ActuMMA ; nouveaux contrôles d'audit (domaine nu, og:url, longueur des descriptions, libellés négatifs).

- **Suite du 12 octobre** : poussée réussie avec le compte propriétaire `EddyEtame` (l'URL du dépôt l'épingle ; le compte `Eddy-etame` n'a pas les droits d'écriture). L'édition due du 10 octobre est publiée (commit `6c5f698`, 6 articles retenus sur 9 sujets rédigés, mêmes scripts que le cron). Polices auto-hébergées (0 requête Google), 20 cartes de partage générées, audit : 42 images de partage présentes et toutes différentes. Le workflow construit et audite le site avant toute rédaction payante.
- **Secret créé par Eddy le 12 octobre** (`OPENAI_API_KEY` masqué dans l'exécution #20). L'exécution de vérification #20 a montré que La Sueur répond HTTP 403 aux serveurs de GitHub (adresse de centre de données) alors qu'il répond depuis une connexion ordinaire : un refus d'accès est désormais compté et signalé, sans arrêter la vérification ; une édition ignore simplement un sujet illisible. Le résumé de chaque exécution liste l'état des flux et les pages refusées par site.

## 7 octobre 2026

Travail demandé : six actualités véritablement nouvelles tous les trois jours, chaîne autonome ordinateur éteint, vraies photos des personnes concernées, retrait de Guillaume et des galeries de boxe, domaine `actu-mma.com`, déploiement Vercel via GitHub. Skills Desktop Baffled Bar et SEO lus ; aucun fichier GEO/AEO distinct trouvé, règles GEO de Baffled Bar appliquées.

## Réalisé

- Six brèves françaises avec sources originales du 5 au 7 octobre, dates de publication originales et passages justificatifs vérifiés en direct le 7 octobre à 18:55 UTC. Les quinze anciens articles sans preuve sont conservés dans `docs/quarantined-articles.json` et retirés des routes publiques.
- La une trie les articles par date de source ; elle n'affiche que les sources récentes. Trois cartes à droite, bandeau sous la navigation supprimé. Texte public : « Informations vérifiées ». Les explications de pipeline restent dans la documentation.
- Six photos/montage issus des pages sources, WebP 1200 × 675, 47–125 kB. Neuf portraits officiels UFC/ONE ; visuels des événements reliés à ces sources et personnes. Crédits, légendes d'archive et provenance conservés. Les licences de réutilisation ne sont pas confirmées.
- Guillaume, galerie, lightbox et 33 fichiers inutilisés retirés. Cinq clubs corrigés à partir des sites officiels ; Zouhir et le grappling/JJB conservés.
- Trois événements à venir, neuf fiches combattants et six organisations mis à jour avec sources. Retrait des anciennes affirmations PFL et correction des informations ARES/Hexagone/FMMAF.
- Domaine canonique, Schema.org, sources visibles, sitemap, robots, RSS et llms.txt corrigés ; les dates des archives ne sont pas réécrites au build.
- Workflow GitHub Actions sur serveur : créneaux persistés de 72 heures, six sujets nouveaux, rédaction et deuxième contrôle factuel sur source, photos sources redimensionnées, publication atomique/verrou, validation/build/audit, commit et push non forcé sur `main`. Vercel doit recevoir ces pushes via son intégration GitHub.
- Édition initiale enregistrée pour le créneau `2026-10-07T18:00:00.000Z` ; prochain créneau le 10 octobre à 18 h UTC, réveil horaire à la minute 17, avec retard possible du planificateur.
- Mode manuel `validation_only: true` / `--verify-cloud` : test du fournisseur, sources et photos, puis build/audit sans publication ni push.

## Vérifications

- 29 tests de pipeline passés, y compris ancien/futur/sans date, doublon, redirection, calendrier mensuel, preuve absente, lot de cinq, verrou, publication atomique et smoke sans mutation. Deuxième lecture indépendante des tests et du workflow effectuée.
- Build Astro : 36 routes ; audit des titres/H1/canoniques, JSON-LD, fichiers locaux, sources et dimensions des photos passé. XML sitemap et RSS parsés.
- Navigateur : bureau 1440, mobile 375 et 320 pixels ; aucune image cassée ni débordement observé. Menu ouverture/fermeture, Escape et retour du focus vérifiés ; comportement en mode mouvement réduit testé. Navigation sans JavaScript et contenu rendus côté serveur.
- Preuves locales : `.news/qa/home-desktop.jpg`, `.news/qa/home-mobile.jpg` (non versionnées).

## Activation distante encore nécessaire (mise à jour du 12 octobre)

Seul le secret manque : GitHub → Settings → Secrets and variables → Actions → New repository secret `OPENAI_API_KEY`. La variable `MMA_WRITER_MODEL` n'est plus nécessaire. Ensuite : Actions → « Six actualités MMA tous les trois jours » → Run workflow avec `validation_only: false` pour publier tout de suite l'édition due, ou attendre le prochain réveil.

Historique du 7 octobre : le push du commit `80d3824` a réussi sur `main`. GitHub confirme le workflow actif et le statut Vercel « Deployment has completed » pour ce commit. Les réglages secrets/variables GitHub restent inaccessibles via l'API dans cette session ; le fournisseur de rédaction et une vraie exécution du robot ne sont pas vérifiés. Le test local `--verify-cloud` échoue explicitement avec `WRITER_NOT_CONFIGURED` et ne modifie aucune publication. Ne pas présenter les éditions autonomes comme opérationnelles avant leur smoke distant et leur première publication.

1. Push initial effectué vers `EddyEtame/actualites-mma`. Identité auteur/committer vérifiée : `Eddy-etame <eddy.etame@enkoschools.com>` ; aucun trailer d'assistant.
2. Dans les réglages Actions du dépôt : secret `OPENAI_API_KEY`, variable `MMA_WRITER_MODEL` compatible Responses/Structured Outputs ; ne jamais mettre la clé dans le chat ou le dépôt.
3. Autoriser les workflows et le push du jeton Actions dans les règles de branche existantes ; lancer `validation_only: true` et inspecter la fin du workflow.
4. Dans Vercel : dépôt connecté, branche `main`, preset Astro, build `npm run build`, sortie `dist`, domaine `actu-mma.com`. `vercel.json` est présent. Confirmer l'accès du compte correspondant à l'auteur du commit.
5. Vérifier le déploiement Vercel, les DNS/TLS du domaine, puis les pages/sitemap/photos sur l'URL publique. Le domaine n'a pas été confirmé en production pendant la session.
6. Activer les notifications d'échec GitHub Actions et vérifier la première vraie édition distante, son commit à six articles et le déploiement correspondant. Un manque de six sujets frais doit échouer ; ne pas recycler des archives pour remplir le quota.
