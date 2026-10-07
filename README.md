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

Le workflow `.github/workflows/mma-news.yml` fonctionne sur les serveurs GitHub Actions. Une vérification horaire à la minute 17 applique une cadence persistée de 72 heures, ancrée au 7 octobre 2026 à 18 h UTC. L'édition initiale est déjà enregistrée dans ce créneau ; le suivant est le 10 octobre à 18 h UTC. Le planificateur GitHub peut démarrer avec retard.

Chaîne : flux RSS → page originale et date → dédoublonnage → rédaction française fondée sur le corps source → seconde vérification factuelle → photos de la page source, WebP 1200 × 675, maximum 350 kB → publication atomique de six articles → validation et build → commit et push sur `main`. Vercel reçoit ensuite le push via son intégration GitHub.

Configuration requise dans [le dépôt GitHub](https://github.com/EddyEtame/actualites-mma) :

- Secret Actions `OPENAI_API_KEY`, saisi uniquement dans les réglages GitHub.
- Variable Actions `MMA_WRITER_MODEL`, identifiant d'un modèle API disponible sur le compte et compatible Responses / Structured Outputs.
- GitHub Actions autorisé sur le dépôt et son jeton autorisé à écrire le contenu ; respecter les règles de protection de `main`.
- Identité Git de publication : `Eddy-etame`, `eddy.etame@enkoschools.com`.

Dans Vercel, relier le dépôt, sélectionner `main` comme branche de production, garder la racine du dépôt, `npm run build` et `dist`, puis rattacher `actu-mma.com` selon les enregistrements DNS indiqués par Vercel. `vercel.json` décrit le build ; il ne crée ni la connexion Vercel, ni le domaine, ni les secrets.

Après configuration, lancer manuellement le workflow avec `validation_only: true` (valeur par défaut). Ce contrôle vérifie le modèle, six sources, leurs photos et le build sans publier de nouveaux articles ni pousser de commit. Son équivalent local est `node scripts/cloud-news-edition.mjs --verify-cloud`.

Activer les notifications d'échec GitHub Actions pour détecter un manque de six informations nouvelles ou une panne. Les photos conservent leur provenance et leur crédit ; aucune licence de réutilisation n'est présumée.

## État vérifié

Le 7 octobre 2026 : six articles récents et leurs sources vérifiés en direct ; photos sources et portraits officiels ; Guillaume et galeries retirés. Les 29 tests du pipeline et l'audit des 36 pages passent. Le commit `80d3824` est poussé sur `main` ; GitHub confirme le workflow actif et le déploiement Vercel réussi. La rédaction via fournisseur API, une exécution GitHub Actions complète et le domaine de production restent à vérifier. Voir `PROJECT-STATE.md` pour les contrôles et limites précis.

Références de configuration : [GitHub schedules](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule), [Responses / Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [Vercel pour GitHub](https://vercel.com/docs/git/vercel-for-github).
