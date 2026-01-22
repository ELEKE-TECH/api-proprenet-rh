require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');
const errorHandler = require('./utils/errorHandler');
const logger = require('./utils/logger');

// Import des routes
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const agentRoutes = require('./routes/agent.routes');
const clientRoutes = require('./routes/client.routes');
const payrollRoutes = require('./routes/payroll.routes');
const feedbackRoutes = require('./routes/feedback.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const recruitmentRoutes = require('./routes/recruitment.routes');
const tenderSubmissionRoutes = require('./routes/tenderSubmission.routes');
const siteRoutes = require('./routes/site.routes');
const logisticsRoutes = require('./routes/logistics.routes');
const advanceRoutes = require('./routes/advance.routes');
const salaryDashboardRoutes = require('./routes/salary-dashboard.routes');
const workContractRoutes = require('./routes/workContract.routes');
const workCertificateRoutes = require('./routes/workCertificate.routes');
const purchaseOrderRoutes = require('./routes/purchaseOrder.routes');
const endOfWorkDocumentRoutes = require('./routes/endOfWorkDocument.routes');
const badgeRoutes = require('./routes/badge.routes');
const bankRoutes = require('./routes/bank.routes');
const bankTransferOrderRoutes = require('./routes/bankTransferOrder.routes');
const invoiceRoutes = require('./routes/invoice.routes');
const sursalaireRoutes = require('./routes/sursalaire.routes');

const app = express();

// Connexion à la base de données (non bloquante)
connectDB().catch(err => {
  logger.error('MongoDB connection failed:', err);
});

// Middlewares
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Désactiver tout cache sur les réponses API pour éviter les données obsolètes
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});

// Servir les fichiers statiques (incluant les sous-dossiers)
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res, filePath) => {
    // Définir les en-têtes appropriés pour les différents types de fichiers
    if (filePath.endsWith('.pdf')) {
      res.setHeader('Content-Type', 'application/pdf');
    } else if (filePath.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
      res.setHeader('Content-Type', `image/${filePath.split('.').pop()}`);
    }
  }
}));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/payrolls', payrollRoutes);
app.use('/api/feedbacks', feedbackRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/recruitment', recruitmentRoutes);
app.use('/api/tender-submissions', tenderSubmissionRoutes);
app.use('/api/sites', siteRoutes);
app.use('/api/logistics', logisticsRoutes);
app.use('/api/advances', advanceRoutes);
app.use('/api/salary-dashboard', salaryDashboardRoutes);
app.use('/api/work-contracts', workContractRoutes);
app.use('/api/work-certificates', workCertificateRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/end-of-work-documents', endOfWorkDocumentRoutes);
app.use('/api/badges', badgeRoutes);
app.use('/api/banks', bankRoutes);
app.use('/api/bank-transfer-orders', bankTransferOrderRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/sursalaires', sursalaireRoutes);

// Gestion des erreurs
app.use(errorHandler);

// Démarrage du serveur
const PORT = process.env.PORT || 5000;

// Gérer les erreurs non capturées
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

const server = app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    logger.error(`Port ${PORT} is already in use`);
    console.error(`\n✗ Erreur: Le port ${PORT} est déjà utilisé`);
    console.error(`✗ Arrêtez l'autre processus ou changez le PORT dans .env\n`);
  } else {
    logger.error('Server error:', error);
    console.error('\n✗ Erreur du serveur:', error.message);
  }
  process.exit(1);
});

module.exports = app;
