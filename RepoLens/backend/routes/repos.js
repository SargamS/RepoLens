const express = require('express');
const repoController = require('../controllers/repoController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

router.get('/', repoController.listRepos);
router.post('/analyze', repoController.analyzeRepo);
router.get('/:repo_id', repoController.getStoredRepo);
router.get('/:repo_id/prs', repoController.getStoredPullRequests);
router.post('/:repo_id/chat', repoController.chatWithRepo);
router.get('/:repo_id/chat', repoController.getChatHistory);

module.exports = router;
