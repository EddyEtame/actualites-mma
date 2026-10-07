# Actu MMA — état du 7 octobre 2026

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

## Activation distante encore nécessaire

Le push du commit `80d3824` a réussi sur `main`. GitHub confirme le workflow actif et le statut Vercel « Deployment has completed » pour ce commit. Les réglages secrets/variables GitHub restent inaccessibles via l'API dans cette session ; le fournisseur de rédaction et une vraie exécution du robot ne sont pas vérifiés. Le test local `--verify-cloud` échoue explicitement avec `WRITER_NOT_CONFIGURED` et ne modifie aucune publication. Ne pas présenter les éditions autonomes comme opérationnelles avant leur smoke distant et leur première publication.

1. Push initial effectué vers `EddyEtame/actualites-mma`. Identité auteur/committer vérifiée : `Eddy-etame <eddy.etame@enkoschools.com>` ; aucun trailer d'assistant.
2. Dans les réglages Actions du dépôt : secret `OPENAI_API_KEY`, variable `MMA_WRITER_MODEL` compatible Responses/Structured Outputs ; ne jamais mettre la clé dans le chat ou le dépôt.
3. Autoriser les workflows et le push du jeton Actions dans les règles de branche existantes ; lancer `validation_only: true` et inspecter la fin du workflow.
4. Dans Vercel : dépôt connecté, branche `main`, preset Astro, build `npm run build`, sortie `dist`, domaine `actu-mma.com`. `vercel.json` est présent. Confirmer l'accès du compte correspondant à l'auteur du commit.
5. Vérifier le déploiement Vercel, les DNS/TLS du domaine, puis les pages/sitemap/photos sur l'URL publique. Le domaine n'a pas été confirmé en production pendant la session.
6. Activer les notifications d'échec GitHub Actions et vérifier la première vraie édition distante, son commit à six articles et le déploiement correspondant. Un manque de six sujets frais doit échouer ; ne pas recycler des archives pour remplir le quota.
