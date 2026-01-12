const Payroll = require('../models/payroll.model');
const Advance = require('../models/advance.model');
const Agent = require('../models/agent.model');
const logger = require('../utils/logger');

// Dashboard global du module salaire
exports.getDashboard = async (req, res) => {
  try {
    const { periodStart, periodEnd } = req.query;
    
    // Définir la période par défaut (mois en cours)
    const now = new Date();
    const startDate = periodStart ? new Date(periodStart) : new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = periodEnd ? new Date(periodEnd) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Statistiques des avances
    const totalAdvances = await Advance.countDocuments({
      requestedAt: { $gte: startDate, $lte: endDate }
    });
    
    const pendingAdvances = await Advance.countDocuments({
      status: 'requested',
      requestedAt: { $gte: startDate, $lte: endDate }
    });
    
    const approvedAdvances = await Advance.countDocuments({
      status: 'approved',
      requestedAt: { $gte: startDate, $lte: endDate }
    });
    
    const totalAdvanceAmount = await Advance.aggregate([
      {
        $match: {
          requestedAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ]);
    
    const pendingAdvanceAmount = await Advance.aggregate([
      {
        $match: {
          status: 'approved',
          remaining: { $gt: 0 }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$remaining' }
        }
      }
    ]);

    // Statistiques des salaires
    const totalPayrolls = await Payroll.countDocuments({
      periodStart: { $gte: startDate, $lte: endDate }
    });
    
    const paidPayrolls = await Payroll.countDocuments({
      paid: true,
      periodStart: { $gte: startDate, $lte: endDate }
    });
    
    const unpaidPayrolls = await Payroll.countDocuments({
      paid: false,
      periodStart: { $gte: startDate, $lte: endDate }
    });

    const payrollStats = await Payroll.aggregate([
      {
        $match: {
          periodStart: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: null,
          totalGross: { $sum: '$grossAmount' },
          totalNet: { $sum: '$netAmount' },
          totalDeductions: { $sum: { $subtract: ['$grossAmount', '$netAmount'] } },
          totalBonuses: {
            $sum: {
              $cond: [
                { $isArray: '$adjustments' },
                {
                  $sum: {
                    $map: {
                      input: {
                        $filter: {
                          input: '$adjustments',
                          as: 'adj',
                          cond: { $eq: ['$$adj.type', 'bonus'] }
                        }
                      },
                      as: 'bonus',
                      in: '$$bonus.amount'
                    }
                  }
                },
                0
              ]
            }
          },
          totalDeductionsFromAdjustments: {
            $sum: {
              $cond: [
                { $isArray: '$adjustments' },
                {
                  $sum: {
                    $map: {
                      input: {
                        $filter: {
                          input: '$adjustments',
                          as: 'adj',
                          cond: { $eq: ['$$adj.type', 'deduction'] }
                        }
                      },
                      as: 'ded',
                      in: '$$ded.amount'
                    }
                  }
                },
                0
              ]
            }
          }
        }
      }
    ]);

    // Statistiques par agent
    const payrollsByAgent = await Payroll.aggregate([
      {
        $match: {
          periodStart: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$agentId',
          totalGross: { $sum: '$grossAmount' },
          totalNet: { $sum: '$netAmount' },
          count: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'agents',
          localField: '_id',
          foreignField: '_id',
          as: 'agent'
        }
      },
      {
        $unwind: {
          path: '$agent',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          agentId: '$_id',
          agentName: {
            $concat: [
              { $ifNull: ['$agent.firstName', ''] },
              ' ',
              { $ifNull: ['$agent.lastName', ''] }
            ]
          },
          totalGross: 1,
          totalNet: 1,
          count: 1
        }
      },
      {
        $sort: { totalNet: -1 }
      },
      {
        $limit: 10
      }
    ]);

    // Dernières avances
    const recentAdvances = await Advance.find({
      requestedAt: { $gte: startDate, $lte: endDate }
    })
      .populate('agentId', 'firstName lastName')
      .sort({ requestedAt: -1 })
      .limit(5);

    // Derniers salaires
    const recentPayrolls = await Payroll.find({
      periodStart: { $gte: startDate, $lte: endDate }
    })
      .populate('agentId', 'firstName lastName')
      .sort({ periodEnd: -1 })
      .limit(5);

    // Évolution des paies par mois (6 derniers mois)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const payrollEvolution = await Payroll.aggregate([
      {
        $match: {
          createdAt: { $gte: sixMonthsAgo }
        }
      },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          totalGross: { $sum: '$grossAmount' },
          totalNet: { $sum: '$netAmount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Répartition par type de paiement
    const payrollsByType = await Payroll.aggregate([
      {
        $match: {
          periodStart: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$paymentType',
          total: { $sum: '$netAmount' },
          count: { $sum: 1 }
        }
      }
    ]);

    // Évolution des avances par mois
    const advancesEvolution = await Advance.aggregate([
      {
        $match: {
          requestedAt: { $gte: sixMonthsAgo }
        }
      },
      {
        $group: {
          _id: { year: { $year: '$requestedAt' }, month: { $month: '$requestedAt' } },
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Répartition des avances par statut
    const advancesByStatus = await Advance.aggregate([
      {
        $match: {
          requestedAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$status',
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    const stats = {
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      },
      advances: {
        total: totalAdvances || 0,
        pending: pendingAdvances || 0,
        approved: approvedAdvances || 0,
        totalAmount: totalAdvanceAmount[0]?.total || 0,
        pendingAmount: pendingAdvanceAmount[0]?.total || 0
      },
      payrolls: {
        total: totalPayrolls || 0,
        paid: paidPayrolls || 0,
        unpaid: unpaidPayrolls || 0,
        totalGross: payrollStats[0]?.totalGross || 0,
        totalNet: payrollStats[0]?.totalNet || 0,
        totalDeductions: payrollStats[0]?.totalDeductions || 0,
        totalBonuses: payrollStats[0]?.totalBonuses || 0,
        totalDeductionsFromAdjustments: payrollStats[0]?.totalDeductionsFromAdjustments || 0
      },
      topAgents: payrollsByAgent || [],
      recentAdvances: recentAdvances || [],
      recentPayrolls: recentPayrolls || [],
      charts: {
        payrollEvolution: payrollEvolution.map(item => ({
          month: item._id.month,
          year: item._id.year,
          totalGross: item.totalGross,
          totalNet: item.totalNet,
          count: item.count
        })),
        payrollsByType: payrollsByType.reduce((acc, item) => {
          acc[item._id] = { total: item.total, count: item.count };
          return acc;
        }, {}),
        advancesEvolution: advancesEvolution.map(item => ({
          month: item._id.month,
          year: item._id.year,
          total: item.total,
          count: item.count
        })),
        advancesByStatus: advancesByStatus.reduce((acc, item) => {
          acc[item._id] = { total: item.total, count: item.count };
          return acc;
        }, {})
      }
    };

    res.json({ stats });
  } catch (error) {
    logger.error('Erreur dashboard salaire:', error);
    res.status(500).json({ message: error.message });
  }
};

