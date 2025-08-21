import agentRoutes from './agentRoutes'
import authRoutesV2 from './authRoutesV2'
import collectionRoutesV2 from './collectionRoutesV2'
import creationRoutesV2 from './creationRoutesV2'
import creatorRoutesV2 from './creatorRoutesV2'
import feedRoutesV2 from './feedRoutesV2'
import modelRoutesV2 from './modelRoutesV2'
import notificationRoutes from './notificationRoutes'
import sessionRoutesV2 from './sessionRoutesV2'
import taskRoutesV2 from './taskRoutesV2'
// import testRoutes from './testRoutes'
import threadRoutes from './threadRoutes'
import toolRoutesV2 from './toolRoutesV2'
import userRoutes from './userRoutes'

export const routes = [
  authRoutesV2,
  creatorRoutesV2,
  toolRoutesV2,
  taskRoutesV2,
  modelRoutesV2,
  creationRoutesV2,
  feedRoutesV2,
  collectionRoutesV2,
  threadRoutes,
  agentRoutes,
  userRoutes,
  sessionRoutesV2,
  notificationRoutes,
  // testRoutes,
]
