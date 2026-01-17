const Agent = require('../models/agent.model');
const Client = require('../models/client.model');
const Payroll = require('../models/payroll.model');
const Site = require('../models/site.model');
const Recruitment = require('../models/recruitment.model');
const Advance = require('../models/advance.model');
const logger = require('../utils/logger');

// Obtenir les statistiques du dashboard
exports.getStats = async (req, res) => {
  try {
    const {
      startDate,
      endDate
    } = req.query;

    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) {
        dateFilter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateFilter.createdAt.$lte = end;
      }
    }

    // Statistiques générales
    const totalAgents = await Agent.countDocuments();
    const availableAgents = await Agent.countDocuments({ status: 'available' });
    const assignedAgents = await Agent.countDocuments({ status: 'assigned' });
    const totalClients = await Client.countDocuments();
    const activeClients = await Client.countDocuments({ status: 'active' });


    // Sites
    const totalSites = await Site.countDocuments();
    const activeSites = await Site.countDocuments({ status: 'active' });
    const sitesByType = await Site.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]);

    // Paie
    const unpaidPayrolls = await Payroll.countDocuments({ paid: false });
    const totalPayrollAmount = await Payroll.aggregate([
      { $match: { paid: false } },
      { $group: { _id: null, total: { $sum: '$netAmount' } } }
    ]);
    const paidPayrolls = await Payroll.countDocuments({ paid: true });
    const totalPaidAmount = await Payroll.aggregate([
      { $match: { paid: true } },
      { $group: { _id: null, total: { $sum: '$netAmount' } } }
    ]);

    // Évolution des paies sur les 6 derniers mois
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const payrollEvolution = await Payroll.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          total: { $sum: '$netAmount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Recrutement
    const totalRecruitments = await Recruitment.countDocuments();
    const pendingRecruitments = await Recruitment.countDocuments({ status: 'pending' });
    const acceptedRecruitments = await Recruitment.countDocuments({ status: 'accepted' });
    const convertedRecruitments = await Recruitment.countDocuments({ status: 'converted' });
    const recruitmentByStatus = await Recruitment.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    // Avances
    const totalAdvances = await Advance.countDocuments();
    const requestedAdvances = await Advance.countDocuments({ status: 'requested' });
    const approvedAdvances = await Advance.countDocuments({ status: 'approved' });
    const totalAdvanceAmount = await Advance.aggregate([
      { $match: { status: { $in: ['requested', 'approved'] } } },
      { $group: { _id: null, total: { $sum: '$amount' }, remaining: { $sum: '$remaining' } } }
    ]);

    // Répartition des agents par statut
    const agentsByStatus = await Agent.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    // Répartition des agents par mode de paiement
    const agentsByPaymentMethod = await Agent.aggregate([
      { 
        $group: { 
          _id: { $ifNull: ['$paymentMethod', 'bank_transfer'] }, 
          count: { $sum: 1 } 
        } 
      }
    ]);
    
    // Calculer les totaux depuis l'agrégation
    const agentsWithBank = agentsByPaymentMethod.find(item => item._id === 'bank_transfer')?.count || 0;
    const agentsWithCash = agentsByPaymentMethod.find(item => item._id === 'cash')?.count || 0;

    // Top 5 clients par nombre de sites
    const topClientsBySites = await Site.aggregate([
      { $group: { _id: '$clientId', siteCount: { $sum: 1 } } },
      { $sort: { siteCount: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'clients',
          localField: '_id',
          foreignField: '_id',
          as: 'client'
        }
      },
      { $unwind: '$client' },
      { $project: { clientName: '$client.name', siteCount: 1 } }
    ]);

    res.json({
      overview: {
        agents: {
          total: totalAgents,
          available: availableAgents,
          assigned: assignedAgents,
          inactive: totalAgents - availableAgents - assignedAgents,
          byStatus: agentsByStatus.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
          }, {}),
          byPaymentMethod: agentsByPaymentMethod.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
          }, {}),
          withBank: agentsWithBank,
          withCash: agentsWithCash
        },
        clients: {
          total: totalClients,
          active: activeClients,
          inactive: totalClients - activeClients
        },
        sites: {
          total: totalSites,
          active: activeSites,
          byType: sitesByType.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
          }, {})
        }
      },
      payroll: {
        unpaid: unpaidPayrolls,
        totalAmount: totalPayrollAmount[0]?.total || 0,
        paid: paidPayrolls,
        paidAmount: totalPaidAmount[0]?.total || 0,
        evolution: payrollEvolution.map(item => ({
          month: item._id.month,
          year: item._id.year,
          total: item.total,
          count: item.count
        }))
      },
      recruitment: {
        total: totalRecruitments,
        pending: pendingRecruitments,
        accepted: acceptedRecruitments,
        converted: convertedRecruitments,
        byStatus: recruitmentByStatus.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {})
      },
      advances: {
        total: totalAdvances,
        requested: requestedAdvances,
        approved: approvedAdvances,
        totalAmount: totalAdvanceAmount[0]?.total || 0,
        remainingAmount: totalAdvanceAmount[0]?.remaining || 0
      },
      topClients: topClientsBySites
    });
  } catch (error) {
    logger.error('Erreur récupération statistiques:', error);
    res.status(500).json({ message: error.message });
  }
};


