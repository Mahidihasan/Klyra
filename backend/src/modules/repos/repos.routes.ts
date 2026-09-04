import { Router } from 'express';
import coreRoutes from './repos.routes.core';
import gitRoutes from './repos.routes.git';
import collabRoutes from './repos.routes.collab';
import issueRoutes from './repos.routes.issues';
import opsRoutes from './repos.routes.ops';
import releaseRoutes from './repos.routes.releases';

/**
 * Klyra API Repository System — aggregated router.
 * Mounted at /api in app.ts. Git Smart HTTP is mounted separately
 * (see git.http.ts) with raw-body handling.
 */
const router = Router();

router.use(coreRoutes);   // auth, repositories, overview, import
router.use(gitRoutes);    // branches, commits, tree, files, diffs, tags
router.use(collabRoutes); // pull requests, reviews, merge
router.use(issueRoutes);  // issues, collaborators, activity
router.use(opsRoutes);    // API detection, CI runs
router.use(releaseRoutes); // releases, deployments, marketplace

export default router;
