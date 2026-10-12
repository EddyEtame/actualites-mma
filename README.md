# PRISE MMA / actu-mma.com

Média français consacré aux actualités MMA, aux combats à venir, aux combattants, aux organisations et aux clubs. Astro 7 produit des pages statiques ; Node.js 22.19 minimum (ou Node 24) et Sharp servent à la collecte et au traitement des photos.

```sh
npm ci
npm run dev
npm test
npm run news:validate
npm run build
npm run audit
```

## Cartes de partage et polices

Chaque page montre sa propre image quand un lien est partagé : sa photo (articles, combattants) ou une carte 1200 × 630 composée pour elle (accueil, rubriques, organisations, événements, clubs sans photo). Après avoir modifié `events.json`, `organisations.json` ou `clubs.json`, lancer `npm run og` puis versionner `public/og` ; l'audit refuse une image de partage absente ou déjà utilisée par une autre page. Le rendu du texte utilise `scripts/og-fonts/Oswald-Variable.ttf` (licence OFL) et n'a lieu qu'en local : ni Vercel ni GitHub Actions ne dessinent de texte.

Les polices (Oswald, Outfit, Newsreader, JetBrains Mono) sont servies depuis `public/assets/fonts` : aucune requête vers Google Fonts, donc aucune adresse IP de visiteur transmise à un tiers pour afficher le texte.

## Actualités vérifiables

La une suit la date originale de la source. Les articles indiquent leur propre date de publication, la date de l'information, les liens sources et les crédits photo. Les anciennes données sans preuve sont conservées hors publication dans `docs/quarantined-*.json`.

```sh
npm run news:discover
node scripts/ai-wired-crawler.mjs --validate --verify-live
node scripts/ai-wired-crawler.mjs --publish-batch .news/batch.json --dry-run
npm run images -- --input .news/batch.json
```

La découverte ne publie jamais à elle seule. Chaque lot doit contenir exactement six sujets nouveaux de MMA, soutenus par des sources originales de moins de 72 heures. Date manquante, source ancienne, doublon, preuve absente, photo inutilisable ou contrôle factuel négatif bloque la publication entière. Aucun ancien article n'est redaté pour remplir le quota.

## Exécution cloud, ordinateur éteint

Le workflow `.github/workflows/mma-news.yml` fonctionne sur les serveurs GitHub Actions. Deux réveils par heure (minutes 17 et 47) appliquent une cadence persistée de 72 heures, ancrée au 7 octobre 2026 à 18 h UTC ; le planificateur GitHub en abandonne beaucoup (19 réveils sur environ 106 du 8 au 12 octobre 2026), d'où deux réveils. Une édition due mais incomplète (moins de six sujets frais, ou moins de six articles validés) reste « en attente » et repasse au réveil suivant ; l'exécution n'échoue qu'après `pendingGraceHours` (24 h). Une clé absente, refusée ou sans quota échoue immédiatement.

Chaîne : flux RSS → page originale et date (entités HTML décodées) → dédoublonnage → photo de la page source qualifiée avant toute rédaction → rédaction française fondée sur le corps source → seconde vérification factuelle → une révision si un défaut est réparable (preuve, nombre, longueur, kicker, fait non soutenu), puis nouvelle vérification → photos WebP 1200 × 675, maximum 350 kB → publication atomique de six articles → validation, build et audit → commit et push sur `main`. Vercel reçoit ensuite le push via son intégration GitHub. Le résumé de chaque exécution liste les articles retenus et les motifs de rejet.

Configuration requise dans [le dépôt GitHub](https://github.com/EddyEtame/actualites-mma) :

- Secret Actions `OPENAI_API_KEY`, saisi uniquement dans les réglages GitHub (Settings → Secrets and variables → Actions). C'est le seul réglage indispensable.
- Modèle : `writerModel` dans `scripts/news-sources.json` (`gpt-6-luna`, vérifié le 12 octobre 2026). La variable Actions `MMA_WRITER_MODEL` reste possible pour le remplacer sans commit.
- GitHub Actions autorisé sur le dépôt et son jeton autorisé à écrire le contenu ; respecter les règles de protection de `main`.
- Identité Git de publication : `Eddy-etame`, `eddy.etame@enkoschools.com`.

Dans Vercel, relier le dépôt, sélectionner `main` comme branche de production, garder la racine du dépôt, `npm run build` et `dist`, puis rattacher `actu-mma.com` selon les enregistrements DNS indiqués par Vercel. `vercel.json` décrit le build ; il ne crée ni la connexion Vercel, ni le domaine, ni les secrets. Vercel sert `https://www.actu-mma.com` et redirige le domaine nu vers lui : `SITE_URL` (`src/lib/editorial.mjs`) est donc l'origine `www`, unique source des canoniques, du sitemap, du RSS, de llms.txt et des cartes de partage ; l'audit refuse toute URL du domaine nu.

Après configuration, lancer manuellement le workflow avec `validation_only: true` (valeur par défaut). Ce contrôle vérifie la clé et le modèle, l'édition en ligne, les flux et les sujets frais du moment, la chaîne photo et le build, sans rédiger, publier ni pousser. Son équivalent local est `node scripts/cloud-news-edition.mjs --verify-cloud`.

Activer les notifications d'échec GitHub Actions pour détecter un manque de six informations nouvelles ou une panne. Les photos conservent leur provenance et leur crédit ; aucune licence de réutilisation n'est présumée.

## État vérifié

Le 12 octobre 2026 : l'édition du créneau du 10 octobre a échoué à chaque réveil (#12 à #19) faute du secret `OPENAI_API_KEY`. Avec la clé et `gpt-6-luna`, l'ancien code n'aurait retenu qu'un article sur douze : les corps de source français arrivaient avec leurs accents encodés (`&eacute;`…), si bien que les passages de preuve cités par le modèle ne correspondaient pas. Après correction, une édition complète exécutée hors du dépôt a retenu six articles sur sept sujets, puis passé validation, build (42 pages) et audit. Les 42 tests passent. Voir `PROJECT-STATE.md`.

Références de configuration : [GitHub schedules](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule), [Responses / Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [Vercel pour GitHub](https://vercel.com/docs/git/vercel-for-github).
