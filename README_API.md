# API PROPRENET - Documentation

Backend Node.js avec MongoDB pour la gestion de personnel de nettoyage.

## 🚀 Installation

1. Installer les dépendances :
```bash
npm install
```

2. Configurer les variables d'environnement (créer un fichier `.env`) :
```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/proprenet
JWT_SECRET=your-secret-key-here
SUPER_ADMIN_EMAIL=admin@proprenet.com
SUPER_ADMIN_PASSWORD=admin123
SUPER_ADMIN_PHONE=+23500000000
```

3. Créer le super admin :
```bash
npm run seed:super-admin
```

4. Démarrer le serveur :
```bash
npm start
# ou en mode développement
npm run dev
```

## 📋 Rôles utilisateurs

- `super_admin` : Accès complet à toutes les fonctionnalités
- `recruiter` : Gestion des candidatures, contrats, documents
- `planner` : Affectation des missions, suivi du pointage
- `accountant` : Gestion de la paie, facturation, exports
- `agent` : Profil, disponibilité, pointage via app mobile
- `client` : Publication de demandes, notation des agents

## 🔐 Authentification

### Inscription
```http
POST /api/auth/signup
Content-Type: application/json

{
  "email": "user@example.com",
  "phone": "+23512345678",
  "password": "password123",
  "role": "agent"
}
```

### Connexion
```http
POST /api/auth/signin
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

Réponse :
```json
{
  "id": "...",
  "email": "user@example.com",
  "phone": "+23512345678",
  "role": "agent",
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Utilisation du token
Ajouter le header dans les requêtes protégées :
```
Authorization: Bearer <accessToken>
```

## 📚 Endpoints principaux

### Agents

- `GET /api/agents` - Liste des agents (filtrable par statut, compétences, tarif, zone)
- `GET /api/agents/:id` - Détails d'un agent
- `POST /api/agents` - Créer un agent (recruiter, super_admin)
- `PUT /api/agents/:id` - Mettre à jour un agent
- `DELETE /api/agents/:id` - Supprimer un agent (super_admin)
- `GET /api/agents/available` - Agents disponibles pour une mission

### Clients

- `GET /api/clients` - Liste des clients
- `GET /api/clients/:id` - Détails d'un client
- `POST /api/clients` - Créer un client (recruiter, super_admin)
- `PUT /api/clients/:id` - Mettre à jour un client
- `DELETE /api/clients/:id` - Supprimer un client (super_admin)

### Missions

- `GET /api/missions` - Liste des missions (filtrable par statut, client, zone, compétences)
- `GET /api/missions/:id` - Détails d'une mission
- `POST /api/missions` - Créer une mission (planner, client, super_admin)
- `PUT /api/missions/:id` - Mettre à jour une mission
- `DELETE /api/missions/:id` - Supprimer une mission
- `POST /api/missions/:id/assign` - Assigner un agent à une mission

Exemple création mission :
```json
{
  "clientId": "...",
  "title": "Nettoyage quotidien",
  "description": "Nettoyage des bureaux",
  "startDatetime": "2024-01-15T08:00:00Z",
  "endDatetime": "2024-01-15T12:00:00Z",
  "requiredSkills": ["ménage", "lessive"],
  "requiredLanguages": ["français"],
  "hourlyRate": 3000,
  "location": {
    "coordinates": [12.123, 15.456],
    "address": "123 Rue Example"
  }
}
```

### Affectations (Assignments)

- `GET /api/assignments` - Liste des affectations
- `GET /api/assignments/:id` - Détails d'une affectation
- `POST /api/assignments/:id/accept` - Accepter une affectation (agent)
- `POST /api/assignments/:id/decline` - Refuser une affectation (agent)
- `PUT /api/assignments/:id/status` - Mettre à jour le statut

### Pointage (TimeLogs)

- `GET /api/timelogs` - Liste des pointages
- `GET /api/timelogs/:id` - Détails d'un pointage
- `POST /api/timelogs/:assignmentId/checkin` - Check-in (pointage d'entrée)
- `POST /api/timelogs/:assignmentId/checkout` - Check-out (pointage de sortie)
- `GET /api/timelogs/export` - Export pour la paie

Exemple check-in :
```json
{
  "location": {
    "coordinates": [12.123, 15.456],
    "address": "123 Rue Example"
  },
  "photo": "path/to/photo.jpg"
}
```

### Paie (Payrolls)

- `GET /api/payrolls` - Liste des paies
- `GET /api/payrolls/:id` - Détails d'une paie
- `POST /api/payrolls/generate` - Générer une paie pour un agent
- `PUT /api/payrolls/:id/paid` - Marquer une paie comme payée
- `GET /api/payrolls/export` - Export CSV des paies

Exemple génération paie :
```json
{
  "agentId": "...",
  "periodStart": "2024-01-01",
  "periodEnd": "2024-01-31",
  "paymentType": "hourly",
  "deductions": {
    "taxes": 5000,
    "socialSecurity": 3000
  },
  "bonuses": {
    "performance": 10000
  }
}
```

### Documents

- `GET /api/documents` - Liste des documents
- `GET /api/documents/:id` - Détails d'un document
- `POST /api/documents/upload` - Upload un document (multipart/form-data)
- `PUT /api/documents/:id/verify` - Vérifier un document
- `DELETE /api/documents/:id` - Supprimer un document

### Feedback

- `GET /api/feedbacks` - Liste des feedbacks
- `GET /api/feedbacks/:id` - Détails d'un feedback
- `POST /api/feedbacks` - Créer un feedback (client)
- `PUT /api/feedbacks/:id` - Mettre à jour un feedback
- `PUT /api/feedbacks/:id/respond` - Répondre à un feedback
- `DELETE /api/feedbacks/:id` - Supprimer un feedback

### Matching

- `GET /api/matching/mission/:missionId` - Trouver les agents correspondants
- `GET /api/matching/mission/:missionId/suggestions` - Suggestions d'agents (top N)

### Dashboard

- `GET /api/dashboard/stats` - Statistiques générales
- `GET /api/dashboard/active-missions` - Missions en cours
- `GET /api/dashboard/delays-absences` - Retards et absences

## 🔍 Filtres et recherche

### Agents
- `?status=available` - Filtrer par statut
- `?skills=ménage,lessive` - Filtrer par compétences
- `?minRate=2000&maxRate=5000` - Filtrer par tarif
- `?zone[lat]=15.0&zone[lng]=12.0&zone[radius]=10` - Recherche géospatiale (km)
- `?page=1&limit=10` - Pagination

### Missions
- `?status=open` - Filtrer par statut
- `?clientId=...` - Filtrer par client
- `?skills=ménage` - Filtrer par compétences requises
- `?zone[lat]=15.0&zone[lng]=12.0&zone[radius]=10` - Recherche géospatiale

## 📊 Modèles de données

### Agent
- Informations personnelles (nom, prénom, date de naissance)
- Compétences et langues
- Localisation GPS
- Disponibilité par jour
- Tarif horaire
- Statut (available, assigned, inactive, under_verification)
- Note moyenne

### Mission
- Informations client
- Titre et description
- Dates de début/fin
- Compétences et langues requises
- Localisation
- Statut (open, assigned, in_progress, completed, cancelled)
- Récurrence optionnelle

### TimeLog
- Check-in/check-out avec horodatage
- Localisation GPS
- Photos optionnelles
- Calcul automatique des heures travaillées

### Payroll
- Période (début/fin)
- Type de paiement (hourly, daily, fixed, commission)
- Montant brut/net
- Déductions et bonus
- Statut de paiement

## 🔒 Sécurité

- Authentification JWT
- Hashage des mots de passe (bcrypt)
- Contrôle d'accès par rôle (RBAC)
- Validation des données
- Protection CORS

## 📝 Notes importantes

1. **Géolocalisation** : Les coordonnées GPS sont au format `[longitude, latitude]` (ordre MongoDB)

2. **Statuts des agents** :
   - `under_verification` : En attente de vérification des documents
   - `available` : Disponible pour missions
   - `assigned` : Actuellement assigné à une mission
   - `inactive` : Inactif

3. **Statuts des missions** :
   - `open` : Ouverte, recherche d'agent
   - `assigned` : Agent assigné
   - `in_progress` : En cours
   - `completed` : Terminée
   - `cancelled` : Annulée

4. **Matching automatique** : Le service de matching calcule un score de correspondance basé sur :
   - Compétences (40 points)
   - Langues (15 points)
   - Localisation (20 points)
   - Note moyenne (15 points)
   - Disponibilité (5 points)
   - Tarif (5 points)

## 🐛 Dépannage

### Erreur de connexion MongoDB
Vérifier que MongoDB est démarré :
```bash
# Windows
net start MongoDB

# Linux/Mac
sudo systemctl start mongod
```

### Port déjà utilisé
Changer le PORT dans le fichier `.env` ou arrêter le processus utilisant le port.

## 📞 Support

Pour toute question ou problème, contactez l'équipe PROPRENET.

