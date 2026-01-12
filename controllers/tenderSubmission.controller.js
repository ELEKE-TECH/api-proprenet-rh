const TenderSubmission = require('../models/tenderSubmission.model');
const Document = require('../models/document.model');
const logger = require('../utils/logger');

// Créer une soumission d'appel d'offres
exports.create = async (req, res) => {
  try {
    const {
      tenderReference,
      companyInfo,
      technicalOffer,
      financialOffer,
      documents
    } = req.body;

    const submission = new TenderSubmission({
      tenderReference,
      companyInfo,
      technicalOffer,
      financialOffer,
      documents: documents || [],
      status: 'draft',
      createdBy: req.userId
    });

    await submission.save();

    res.status(201).json({
      message: 'Soumission créée avec succès',
      submission
    });
  } catch (error) {
    logger.error('Erreur création soumission:', error);
    res.status(500).json({ message: error.message });
  }
};

// Obtenir toutes les soumissions
exports.findAll = async (req, res) => {
  try {
    const {
      status,
      tenderReference,
      page = 1,
      limit = 10
    } = req.query;

    const query = {};

    if (status) {
      query.status = status;
    }

    if (tenderReference) {
      query.tenderReference = tenderReference;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const submissions = await TenderSubmission.find(query)
      .populate('createdBy', 'email')
      .populate('reviewedBy', 'email')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ submissionDate: -1 });

    const total = await TenderSubmission.countDocuments(query);

    res.json({
      submissions,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Erreur récupération soumissions:', error);
    res.status(500).json({ message: error.message });
  }
};

// Obtenir une soumission par ID
exports.findOne = async (req, res) => {
  try {
    const submission = await TenderSubmission.findById(req.params.id)
      .populate('createdBy', 'email')
      .populate('reviewedBy', 'email');

    if (!submission) {
      return res.status(404).json({ message: 'Soumission non trouvée' });
    }

    res.json({ submission });
  } catch (error) {
    logger.error('Erreur récupération soumission:', error);
    res.status(500).json({ message: error.message });
  }
};

// Soumettre une soumission (changer le statut de draft à submitted)
exports.submit = async (req, res) => {
  try {
    const submission = await TenderSubmission.findById(req.params.id);

    if (!submission) {
      return res.status(404).json({ message: 'Soumission non trouvée' });
    }

    if (submission.status !== 'draft') {
      return res.status(400).json({
        message: `La soumission ne peut pas être soumise. Statut actuel: ${submission.status}`
      });
    }

    submission.status = 'submitted';
    submission.submittedAt = new Date();
    await submission.save();

    res.json({
      message: 'Soumission soumise avec succès',
      submission
    });
  } catch (error) {
    logger.error('Erreur soumission:', error);
    res.status(500).json({ message: error.message });
  }
};

// Mettre à jour une soumission
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Ne pas permettre la modification si déjà soumise
    const submission = await TenderSubmission.findById(id);
    if (submission && submission.status !== 'draft') {
      return res.status(400).json({
        message: 'Impossible de modifier une soumission déjà soumise'
      });
    }

    const updatedSubmission = await TenderSubmission.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!updatedSubmission) {
      return res.status(404).json({ message: 'Soumission non trouvée' });
    }

    res.json({
      message: 'Soumission mise à jour avec succès',
      submission: updatedSubmission
    });
  } catch (error) {
    logger.error('Erreur mise à jour soumission:', error);
    res.status(500).json({ message: error.message });
  }
};

// Supprimer une soumission (seulement si draft)
exports.delete = async (req, res) => {
  try {
    const submission = await TenderSubmission.findById(req.params.id);

    if (!submission) {
      return res.status(404).json({ message: 'Soumission non trouvée' });
    }

    if (submission.status !== 'draft') {
      return res.status(400).json({
        message: 'Impossible de supprimer une soumission déjà soumise'
      });
    }

    await TenderSubmission.findByIdAndDelete(req.params.id);

    res.json({ message: 'Soumission supprimée avec succès' });
  } catch (error) {
    logger.error('Erreur suppression soumission:', error);
    res.status(500).json({ message: error.message });
  }
};

// Examiner une soumission (pour les admins)
exports.review = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reviewNotes } = req.body;

    const validStatuses = ['under_review', 'accepted', 'rejected'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        message: `Statut invalide. Statuts valides: ${validStatuses.join(', ')}`
      });
    }

    const submission = await TenderSubmission.findByIdAndUpdate(
      id,
      {
        $set: {
          status,
          reviewedBy: req.userId,
          reviewedAt: new Date(),
          reviewNotes
        }
      },
      { new: true }
    );

    if (!submission) {
      return res.status(404).json({ message: 'Soumission non trouvée' });
    }

    res.json({
      message: 'Soumission examinée avec succès',
      submission
    });
  } catch (error) {
    logger.error('Erreur examen soumission:', error);
    res.status(500).json({ message: error.message });
  }
};


