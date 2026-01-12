# PROPRENET Backend

Backend Node.js avec MongoDB pour la gestion de personnel de nettoyage et de services de maison.

## 🎯 Vue d'ensemble

PROPRENET est une application web complète permettant de :
- Recruter, vérifier et onboarder les agents de nettoyage / personnel de maison
- Gérer les profils (compétences, expériences, documents, certificats)
- Proposer/placer des agents auprès de clients (matching automatisé)
- Planifier missions et horaires, gérer pointage (mobile + QR / code)
- Gérer paie, facturation et commissions
- Suivre qualité (feedback client, incidents) et reporting
- Soumettre dossier d'appel d'offre

## 📋 Prérequis

- Node.js (version 16 ou supérieure)
- MongoDB (version 4.4 ou supérieure)
- npm ou yarn

## 🛠️ Installation

1. **Installer les dépendances**
```bash
npm install
```

2. **Configurer les variables d'environnement**

Créer un fichier `.env` à la racine :
```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/proprenet
JWT_SECRET=your-secret-key-here-change-in-production
SUPER_ADMIN_EMAIL=admin@proprenet.com
SUPER_ADMIN_PASSWORD=admin123
SUPER_ADMIN_PHONE=+23500000000
```

3. **Créer le super admin**
```bash
npm run seed:super-admin
```

4. **Démarrer le serveur**
```bash
# Mode développement (avec nodemon)
npm run dev

# Mode production
npm start
```

Le serveur sera accessible sur `http://localhost:5000`

## 👥 Rôles utilisateurs

- **super_admin** : Accès complet à toutes les fonctionnalités
- **recruiter** : Gestion des candidatures, contrats, documents
- **planner** : Affectation des missions, suivi du pointage
- **accountant** : Gestion de la paie, facturation, exports
- **agent** : Profil, disponibilité, pointage via app mobile
- **client** : Publication de demandes, notation des agents

## 📚 Documentation API

Voir [README_API.md](./README_API.md) pour la documentation complète de l'API.

### Endpoints principaux

- **Authentification** : `/api/auth`
- **Agents** : `/api/agents`
- **Clients** : `/api/clients`
- **Missions** : `/api/missions`
- **Affectations** : `/api/assignments`
- **Pointage** : `/api/timelogs`
- **Paie** : `/api/payrolls`
- **Documents** : `/api/documents`
- **Feedback** : `/api/feedbacks`
- **Matching** : `/api/matching`
- **Dashboard** : `/api/dashboard`

## 🏗️ Structure du projet

```
backend/
├── config/           # Configuration (DB, auth)
├── controllers/      # Contrôleurs pour chaque entité
├── middlewares/      # Middlewares (auth, upload, roles)
├── models/          # Modèles Mongoose
├── routes/          # Définition des routes API
├── services/        # Services métier (matching, etc.)
├── scripts/         # Scripts d'initialisation
├── utils/           # Utilitaires (logger, error handler)
├── uploads/         # Fichiers uploadés
├── server.js        # Point d'entrée
└── package.json
```

## 🔐 Authentification

L'API utilise JWT (JSON Web Tokens) pour l'authentification.

### Exemple de connexion

```bash
curl -X POST http://localhost:5000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@proprenet.com",
    "password": "admin123"
  }'
```

### Utilisation du token

Ajouter le header dans les requêtes protégées :
```
Authorization: Bearer <accessToken>
```

## 📊 Modèles de données principaux

- **User** : Utilisateurs du système (tous rôles)
- **Agent** : Profils des agents de nettoyage
- **Client** : Profils des clients
- **Mission** : Missions de nettoyage
- **Assignment** : Affectations agent-mission
- **TimeLog** : Pointages (check-in/check-out)
- **Payroll** : Fiches de paie
- **Document** : Documents (CNI, certificats, etc.)
- **Feedback** : Évaluations clients

## 🚀 Fonctionnalités MVP

### ✅ Implémentées

- [x] Gestion des profils employés (Dossiers, documents scannés, disponibilité)
- [x] Gestion des clients & demandes (contrat / mission)
- [x] Matching manuel + suggestions (compétences, zone, tarif)
- [x] Planning / affectation + notifications SMS/WhatsApp (structure prête)
- [x] Pointage mobile simple (check-in/out + photo/geo)
- [x] Fiches de paie basiques & export CSV
- [x] Tableau de bord admin : effectifs, missions en cours, retards/absences

### 🔄 À venir (Phase 2)

- [ ] Vérification automatisée (KYC, casier judiciaire via prestataire)
- [ ] Contrat digital + signature électronique
- [ ] Module de formation / certification interne
- [ ] Machine learning pour matching + churn prediction
- [ ] Portail client / facturation récurrente / abonnements
- [ ] Intégration POS / API comptable (Sage, QuickBooks)
- [ ] Notifications SMS/WhatsApp (intégration Twilio)

## 🧪 Tests

```bash
# Exécuter les tests
npm test
```

## 🔧 Configuration MongoDB

Par défaut, l'application se connecte à MongoDB local :
```
mongodb://127.0.0.1:27017/proprenet
```

Pour utiliser une instance distante, modifier `MONGODB_URI` dans `.env`.

## 📝 Variables d'environnement

| Variable | Description | Défaut |
|----------|-------------|--------|
| `PORT` | Port du serveur | `5000` |
| `MONGODB_URI` | URI de connexion MongoDB | `mongodb://127.0.0.1:27017/proprenet` |
| `JWT_SECRET` | Clé secrète pour JWT | (requis) |
| `SUPER_ADMIN_EMAIL` | Email du super admin | `admin@proprenet.com` |
| `SUPER_ADMIN_PASSWORD` | Mot de passe du super admin | `admin123` |
| `SUPER_ADMIN_PHONE` | Téléphone du super admin | `+23500000000` |

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
Changer le PORT dans `.env` ou arrêter le processus utilisant le port.

### Erreur "User not found" après création
Vérifier que le script `createSuperAdmin.js` s'est exécuté correctement.

## 📄 Licence

MIT

## 📞 Support

Pour toute question ou problème, contactez l'équipe PROPRENET.

---

**Note** : Ce backend fait partie du système PROPRENET. Consultez la documentation complète dans `README_API.md` pour plus de détails sur l'utilisation de l'API.
