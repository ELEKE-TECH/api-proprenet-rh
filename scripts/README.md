# Scripts de Migration

Ce dossier contient les scripts de migration pour mettre à jour les données existantes dans la base de données.

## Scripts disponibles

### 1. `fix-site-location-geojson.js`
Corrige le format GeoJSON des sites en retirant le champ `address` du sous-objet `location`.

**Problème résolu** : Erreur MongoDB "Can't extract geo keys" lors de la modification des sites.

**Format avant** :
```json
{
  "location": {
    "type": "Point",
    "coordinates": [0, 0],
    "address": "..."  // ❌ Non valide pour GeoJSON
  }
}
```

**Format après** :
```json
{
  "location": {
    "type": "Point",
    "coordinates": [0, 0]  // ✅ Format GeoJSON valide
  },
  "address": "..."  // Au niveau racine
}
```

### 2. `fix-agent-matricules.js`
Convertit les matricules des agents de l'ancien format au nouveau format.

**Format avant** : `090/PNET/2025`  
**Format après** : `09012025` (Number-Month-Year)

- **NN** : Numéro de l'agent (2 chiffres)
- **MM** : Mois de création (01-12)
- **YYYY** : Année de création

### 3. `fix-contract-numbers.js`
Convertit les numéros de contrat de l'ancien format au nouveau format.

**Format avant** : `CT-2026-000089` (6 zéros)  
**Format après** : `CT-2026-0089` (4 zéros)

### 4. `run-all-migrations.js`
Script principal qui exécute toutes les migrations dans l'ordre approprié.

### 5. `reset-payroll-paid-status.js`
Réinitialise le statut de paiement de tous les salaires en les marquant comme non payés.

**⚠️ ATTENTION** : Cette opération est irréversible et va :
- Marquer tous les salaires comme non payés (`paid: false`)
- Effacer les dates de paiement (`paidAt`)
- Effacer les références de paiement (`paymentReference`)

**Usage** :
```bash
node backend/scripts/reset-payroll-paid-status.js
```

**Recommandation** : Faire une sauvegarde de la base de données avant d'exécuter ce script.

## Utilisation

### Sur le serveur de production

**Important** : Assurez-vous que la variable d'environnement `MONGODB_URI` est correctement configurée dans votre fichier `.env` ou dans les variables d'environnement du serveur.

```bash
# Vérifier que la variable d'environnement est définie
echo $MONGODB_URI

# Ou vérifier le fichier .env
cat .env | grep MONGODB_URI
```

### Exécuter toutes les migrations

```bash
cd /home/pnet-rh/htdocs/api.pnet-rh.com/backend
node scripts/run-all-migrations.js
```

### Exécuter une migration spécifique

```bash
# Migration des sites
node scripts/fix-site-location-geojson.js

# Migration des matricules
node scripts/fix-agent-matricules.js

# Migration des numéros de contrat
node scripts/fix-contract-numbers.js

# Réinitialiser le statut de paiement des salaires
node scripts/reset-payroll-paid-status.js
```

### En local (développement)

```bash
# Depuis la racine du projet
node backend/scripts/run-all-migrations.js
```

## Prérequis

- Node.js installé
- MongoDB en cours d'exécution
- Variables d'environnement configurées (notamment `MONGODB_URI`)

### Configuration de MONGODB_URI

Le format de l'URI MongoDB dépend de votre configuration :

**Local** :
```
MONGODB_URI=mongodb://127.0.0.1:27017/proprenet
```

**Serveur distant** :
```
MONGODB_URI=mongodb://username:password@host:port/database
```

**MongoDB Atlas** :
```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database
```

## Notes importantes

1. **Sauvegarde** : Il est fortement recommandé de faire une sauvegarde de la base de données avant d'exécuter les migrations.

2. **Doublons** : Les scripts gèrent automatiquement les cas de doublons en ajustant les numéros si nécessaire.

3. **Logs** : Tous les scripts génèrent des logs détaillés pour suivre le processus de migration.

4. **Erreurs** : Si une erreur survient, le script s'arrête et affiche un message d'erreur détaillé.

## Vérification après migration

Après avoir exécuté les migrations, vous pouvez vérifier que tout s'est bien passé :

```javascript
// Vérifier les sites
db.sites.find({ "location.address": { $exists: true } })

// Vérifier les matricules (ancien format)
db.agents.find({ matriculeNumber: /^\d{2,3}\/PNET\/\d{4}$/ })

// Vérifier les numéros de contrat (ancien format)
db.workcontracts.find({ contractNumber: /^CT-\d{4}-\d{6}$/ })
```

Ces requêtes ne devraient retourner aucun résultat si les migrations ont réussi.

