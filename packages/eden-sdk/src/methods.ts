import {
  AdminApiKeysListArguments,
  AdminApiKeysListResponse,
  AdminAuthChallengeArguments,
  AdminAuthChallengeResponse,
  AdminConceptsExportToHFArguments,
  AdminConceptsRemoveFromHFArguments,
  AdminMannaModifyArguments,
  AdminMannaModifyResponse,
  AdminMannaVouchersCreateArguments,
  AdminMannaVouchersCreateResponse,
  AdminMediaUploadArguments,
  AdminMediaUploadResponse,
  AgentGetArguments,
  AgentGetResponse,
  AgentsCreateArguments,
  AgentsCreateResponse,
  AgentsDeleteArguments,
  AgentsDeleteResponse,
  AgentsGetAllDeploymentsArguments,
  AgentsGetAllDeploymentsResponse,
  AgentsGetAllTriggersArguments,
  AgentsGetAllTriggersResponse,
  AgentsGetPermissionsArguments,
  AgentsGetPermissionsResponse,
  AgentsGetSharedArguments,
  AgentsGetSharedResponse,
  AgentsUpdateArguments,
  AgentsUpdatePermissionsArguments,
  AgentsUpdatePermissionsResponse,
  AgentsUpdateResponse,
  ApiKeysCreateArguments,
  ApiKeysCreateResponse,
  ApiKeysDeleteArguments,
  ApiKeysDeleteResponse,
  ApiKeysListArguments,
  ApiKeysListResponse,
  CharactersCreateArguments,
  CharactersCreateResponse,
  CharactersDeleteArguments,
  CharactersDeleteResponse,
  CharactersGetArguments,
  CharactersGetResponse,
  CharactersListArguments,
  CharactersListResponse,
  CharactersTestArguments,
  CharactersTestResponse,
  CharactersUpdateArguments,
  CharactersUpdateResponse,
  CollectionsAddCreationsArguments,
  CollectionsAddCreationsResponse,
  CollectionsCreateArguments,
  CollectionsCreateResponse,
  CollectionsDeleteArguments,
  CollectionsDeleteResponse,
  CollectionsGetArguments,
  CollectionsGetResponse,
  CollectionsListArguments,
  CollectionsListResponse,
  CollectionsRemoveCreationsArguments,
  CollectionsRemoveCreationsResponse,
  CollectionsUpdateArguments,
  CollectionsUpdateResponse,
  ConceptsDeleteArguments,
  ConceptsDeleteResponse,
  ConceptsGetArguments,
  ConceptsGetResponse,
  ConceptsListArguments,
  ConceptsListResponse,
  ConceptsReactArguments,
  ConceptsReactResponse,
  ConceptsUnreactArguments,
  ConceptsUnreactResponse,
  ConceptsUpdateArguments,
  ConceptsUpdateResponse,
  CreationsDeleteArguments,
  CreationsDeleteResponse,
  CreationsGetArguments,
  CreationsGetResponse,
  CreationsListArguments,
  CreationsListResponse,
  CreationsReactArguments,
  CreationsReactResponse,
  CreationsUnreactArguments,
  CreationsUnreactResponse,
  CreationsUpdateArguments,
  CreationsUpdateResponse,
  CreatorFollowersListArguments,
  CreatorFollowersListResponse,
  CreatorFollowingListResponse,
  CreatorsFollowArguments,
  CreatorsFollowResponse,
  CreatorsGetArguments,
  CreatorsGetMeResponse,
  CreatorsGetResponse,
  CreatorsListArguments,
  CreatorsListResponse,
  CreatorsUnfollowArguments,
  CreatorsUnfollowResponse,
  CreatorsUpdateArguments,
  CreatorsUpdateResponse,
  FeedConceptsArguments,
  FeedConceptsResponse,
  FeedCreationsArguments,
  FeedCreationsCursorArguments,
  FeedCreationsCursorResponse,
  FeedCreationsResponse,
  GeneratorsGetArguments,
  GeneratorsGetResponse,
  GeneratorsListArguments,
  GeneratorsListResponse,
  MannaBalanceGetArguments,
  MannaBalanceGetResponse,
  MannaVoucherRedeemResponse,
  MannaVouchersRedeemArguments,
  MediaBulkDownloadArguments,
  MediaBulkDownloadResponse,
  MediaUploadArguments,
  MediaUploadResponse,
  PaymentsCreateArguments,
  PaymentsCreateResponse,
  PaymentsProductsResponse,
  PaymentsSubscriptionArguments,
  PaymentsSubscriptionResponse,
  SessionEventsListArguments,
  SessionEventsListResponse,
  SessionsAddCharactersArguments,
  SessionsAddCharactersResponse,
  SessionsAddUsersArguments,
  SessionsAddUsersResponse,
  SessionsCreateResponse,
  SessionsDeleteArguments,
  SessionsDeleteResponse,
  SessionsGetArguments,
  SessionsGetResponse,
  SessionsInteractArguments,
  SessionsInteractResponse,
  SessionsListArguments,
  SessionsListResponse,
  TasksCreateArguments,
  TasksCreateResponse,
  TasksGetArguments,
  TasksGetResponse,
  TasksListArguments,
  TasksListResponse,
  adminApiKeysListRequestConfig,
  adminAuthChallengeRequestConfig,
  adminConceptsExportToHFRequestConfig,
  adminConceptsRemoveFromHFRequestConfig,
  adminMannaModifyRequestConfig,
  adminMannaVouchersCreateRequestConfig,
  adminMediaUploadRequestConfig,
  agentGetRequestConfig,
  agentsCreateRequestConfig,
  agentsDeleteRequestConfig,
  agentsGetAllDeploymentsRequestConfig,
  agentsGetAllTriggersRequestConfig,
  agentsUpdateRequestConfig,
  apiKeysCreateRequestConfig,
  apiKeysDeleteRequestConfig,
  apiKeysListRequestConfig,
  charactersCreateRequestConfig,
  charactersDeleteRequestConfig,
  charactersGetRequestConfig,
  charactersListRequestConfig,
  charactersTestRequestConfig,
  charactersUpdateRequestConfig,
  collectionsAddCreationsRequestConfig,
  collectionsCreateRequestConfig,
  collectionsDeleteRequestConfig,
  collectionsGetRequestConfig,
  collectionsListRequestConfig,
  collectionsRemoveCreationsRequestConfig,
  collectionsUpdateRequestConfig,
  conceptsDeleteRequestConfig,
  conceptsGetRequestConfig,
  conceptsListRequestConfig,
  conceptsReactRequestConfig,
  conceptsUnreactRequestConfig,
  conceptsUpdateRequestConfig,
  creationsDeleteRequestConfig,
  creationsGetRequestConfig,
  creationsListRequestConfig,
  creationsReactRequestConfig,
  creationsUnreactRequestConfig,
  creationsUpdateRequestConfig,
  creatorFollowersListRequestConfig,
  creatorFollowingListRequestConfig,
  creatorsFollowRequestConfig,
  creatorsGetMeRequestConfig,
  creatorsGetMeV2RequestConfig,
  creatorsGetRequestConfig,
  creatorsGetV2RequestConfig,
  creatorsListRequestConfig,
  creatorsUnfollowRequestConfig,
  creatorsUpdateRequestConfig,
  creatorsUpdateV2RequestConfig,
  feedConceptsRequestConfig,
  feedCreationsRequestConfig,
  feedCursorCreationsRequestConfig,
  generatorsGetRequestConfig,
  generatorsListRequestConfig,
  mannaBalanceGetRequestConfig,
  mannaVouchersRedeemRequestConfig,
  mediaBulkDownloadRequestConfig,
  mediaUploadRequestConfig,
  paymentsCreateRequestConfig,
  paymentsProductsRequestConfig,
  paymentsSubscriptionRequestConfig,
  sessionEventsListRequestConfig,
  sessionsAddCharactersRequestConfig,
  sessionsAddUsersRequestConfig,
  sessionsCreateRequestConfig,
  sessionsDeleteRequestConfig,
  sessionsGetRequestConfig,
  sessionsInteractRequestConfig,
  sessionsListRequestConfig,
  tasksCostRequestConfig,
  tasksCreateRequestConfig,
  tasksGetRequestConfig,
  tasksListRequestConfig,
} from './models'
import {
  AgentsCreateTriggerArguments,
  AgentsCreateTriggerResponse,
  AgentsDeleteDeploymentArguments,
  AgentsDeleteDeploymentResponse,
  AgentsDeleteTriggerArguments,
  AgentsDeleteTriggerResponse,
  AgentsDeployArguments,
  AgentsDeployResponse,
  AgentsGetDeploymentsArguments,
  AgentsGetDeploymentsResponse,
  AgentsGetTriggersArguments,
  AgentsGetTriggersResponse,
  AgentsLikeArguments,
  AgentsLikeResponse,
  AgentsStopDeploymentArguments,
  AgentsStopDeploymentResponse,
  AgentsUnlikeArguments,
  AgentsUnlikeResponse,
  AgentsUpdateDeploymentArguments,
  AgentsUpdateDeploymentResponse,
  AgentsUpdateTriggerArguments,
  AgentsUpdateTriggerResponse,
  CollectionsV2AddCreationsArguments,
  CollectionsV2AddCreationsResponse,
  CollectionsV2CreateArguments,
  CollectionsV2CreateResponse,
  CollectionsV2DeleteArguments,
  CollectionsV2DeleteResponse,
  CollectionsV2GetArguments,
  CollectionsV2GetCreationsArguments,
  CollectionsV2GetCreationsResponse,
  CollectionsV2GetLightArguments,
  CollectionsV2GetLightResponse,
  CollectionsV2GetResponse,
  CollectionsV2RemoveCreationsArguments,
  CollectionsV2RemoveCreationsResponse,
  CollectionsV2UpdateArguments,
  CollectionsV2UpdateResponse,
  CreationsV2BulkPatchArguments,
  CreationsV2BulkPatchResponse,
  CreationsV2GetArguments,
  CreationsV2GetResponse,
  CreationsV2LikeArguments,
  CreationsV2LikeResponse,
  CreationsV2PatchArguments,
  CreationsV2PatchResponse,
  CreationsV2UnlikeArguments,
  CreationsV2UnlikeResponse,
  FeedCreationsV2CursorArguments,
  FeedCreationsV2CursorResponse,
  ModelsV2GetArguments,
  ModelsV2GetResponse,
  ModelsV2LikeArguments,
  ModelsV2LikeResponse,
  ModelsV2ListArguments,
  ModelsV2ListResponse,
  ModelsV2PatchArguments,
  ModelsV2PatchResponse,
  ModelsV2UnlikeArguments,
  ModelsV2UnlikeResponse,
  NotificationsArchiveArguments,
  NotificationsArchiveResponse,
  NotificationsCountArguments,
  NotificationsCountResponse,
  NotificationsCreateArguments,
  NotificationsCreateResponse,
  NotificationsListArguments,
  NotificationsListResponse,
  NotificationsMarkReadArguments,
  NotificationsMarkReadResponse,
  SessionsV2CancelArguments,
  SessionsV2CancelResponse,
  SessionsV2CreateArguments,
  SessionsV2CreateResponse,
  SessionsV2DeleteArguments,
  SessionsV2DeleteResponse,
  SessionsV2GetArguments,
  SessionsV2GetResponse,
  SessionsV2ListArguments,
  SessionsV2ListResponse,
  SessionsV2MessageArguments,
  SessionsV2MessageReactArguments,
  SessionsV2MessageReactResponse,
  SessionsV2MessageResponse,
  SessionsV2RenameArguments,
  SessionsV2RenameResponse,
  SessionsV2ShareCreateArguments,
  SessionsV2ShareCreateResponse,
  SessionsV2ShareDeleteArguments,
  SessionsV2ShareDeleteResponse,
  SessionsV2ShareGetArguments,
  SessionsV2ShareGetResponse,
  TasksV2CancelArguments,
  TasksV2CancelResponse,
  TasksV2CreateArguments,
  TasksV2CreateResponse,
  TasksV2GetArguments,
  TasksV2GetResponse,
  TasksV2ListArguments,
  TasksV2ListResponse,
  ThreadsCreateArguments,
  ThreadsCreateResponse,
  ThreadsDeleteArguments,
  ThreadsDeleteResponse,
  ThreadsGetArguments,
  ThreadsGetResponse,
  ThreadsListArguments,
  ThreadsListResponse,
  ThreadsMessageArguments,
  ThreadsMessageReactArguments,
  ThreadsMessageReactResponse,
  ThreadsMessageResponse,
  ThreadsPinMessageArguments,
  ThreadsPinMessageResponse,
  ThreadsRenameArguments,
  ThreadsRenameResponse,
  ThreadsUnpinMessageArguments,
  ThreadsUnpinMessageResponse,
  ToolsGetArgumentsV2,
  ToolsGetResponseV2,
  ToolsListArgumentsV2,
  ToolsListResponseV2,
  agentsCreateTriggerRequestConfig,
  agentsDeleteDeploymentRequestConfig,
  agentsDeleteTriggerRequestConfig,
  agentsDeployRequestConfig,
  agentsGetDeploymentsRequestConfig,
  agentsGetPermissionsRequestConfig,
  agentsGetSharedRequestConfig,
  agentsGetTriggersRequestConfig,
  agentsLikeRequestConfig,
  agentsStopDeploymentRequestConfig,
  agentsUnlikeRequestConfig,
  agentsUpdateDeploymentRequestConfig,
  agentsUpdatePermissionsRequestConfig,
  agentsUpdateTriggerRequestConfig,
  collectionsV2AddCreationsRequestConfig,
  collectionsV2CreateRequestConfig,
  collectionsV2DeleteRequestConfig,
  collectionsV2GetCreationsRequestConfig,
  collectionsV2GetLightRequestConfig,
  collectionsV2GetRequestConfig,
  collectionsV2RemoveCreationsRequestConfig,
  collectionsV2UpdateRequestConfig,
  creationsV2BulkPatchRequestConfig,
  creationsV2GetRequestConfig,
  creationsV2LikeRequestConfig,
  creationsV2PatchRequestConfig,
  creationsV2UnlikeRequestConfig,
  feedCursorCreationsV2RequestConfig,
  modelsV2GetRequestConfig,
  modelsV2LikeRequestConfig,
  modelsV2ListRequestConfig,
  modelsV2PatchRequestConfig,
  modelsV2UnlikeRequestConfig,
  notificationsArchiveRequestConfig,
  notificationsCountRequestConfig,
  notificationsCreateRequestConfig,
  notificationsListRequestConfig,
  notificationsMarkReadRequestConfig,
  sessionsCancelRequestConfigV2,
  sessionsCreateRequestConfigV2,
  sessionsDeleteRequestConfigV2,
  sessionsGetRequestConfigV2,
  sessionsListRequestConfigV2,
  sessionsMessageReactRequestConfigV2,
  sessionsMessageRequestConfigV2,
  sessionsRenameRequestConfigV2,
  sessionsShareCreateRequestConfigV2,
  sessionsShareDeleteRequestConfigV2,
  sessionsShareGetRequestConfigV2,
  tasksV2CancelRequestConfig,
  tasksV2CostRequestConfig,
  tasksV2CreateRequestConfig,
  tasksV2GetRequestConfig,
  tasksV2ListRequestConfig,
  threadsCreateRequestConfig,
  threadsDeleteRequestConfig,
  threadsGetRequestConfig,
  threadsListRequestConfig,
  threadsMessageReactRequestConfig,
  threadsMessageRequestConfig,
  threadsPinMessageRequestConfig,
  threadsRenameRequestConfig,
  threadsUnpinMessageRequestConfig,
  toolsGetRequestConfigV2,
  toolsListRequestConfigV2,
} from './models/v2'
import { WebAPICallOptions, WebAPICallResult } from './types'
import { AxiosRequestConfig } from 'axios'

export default interface Method<
  MethodArguments extends WebAPICallOptions,
  MethodResult extends WebAPICallResult = WebAPICallResult,
> {
  (options?: MethodArguments): Promise<MethodResult>
}

function bindApiCall<
  Arguments extends WebAPICallOptions,
  Result extends WebAPICallResult,
>(
  self: Methods,
  configFn: (options) => AxiosRequestConfig,
): Method<Arguments, Result> {
  // We have to "assert" that the bound method does indeed return the more specific `Result` type instead of just
  // `WebAPICallResult`
  return self.apiCall.bind(self, configFn) as Method<Arguments, Result>
}

// function bindApiCallAsync<
//   Arguments extends WebAPICallOptions,
//   Result extends WebAPICallResult,
// >(
//   self: Methods,
//   configFn: (args: MediaUploadArguments) => Promise<AxiosRequestConfig>,
// ): Method<Arguments, Result> {
//   // We have to "assert" that the bound method does indeed return the more specific `Result` type instead of just
//   // `WebAPICallResult`
//   return self.apiCall.bind(self, configFn) as Method<Arguments, Result>
// }

export abstract class Methods {
  public abstract apiCall(
    configFn: (options: WebAPICallOptions) => AxiosRequestConfig,
    options?: WebAPICallOptions,
  ): Promise<WebAPICallResult>

  public readonly admin = {
    manna: {
      modify: bindApiCall<AdminMannaModifyArguments, AdminMannaModifyResponse>(
        this,
        adminMannaModifyRequestConfig,
      ),
      vouchers: {
        create: bindApiCall<
          AdminMannaVouchersCreateArguments,
          AdminMannaVouchersCreateResponse
        >(this, adminMannaVouchersCreateRequestConfig),
      },
    },
    auth: {
      challenge: bindApiCall<
        AdminAuthChallengeArguments,
        AdminAuthChallengeResponse
      >(this, adminAuthChallengeRequestConfig),
    },
    media: {
      upload: bindApiCall<AdminMediaUploadArguments, AdminMediaUploadResponse>(
        this,
        adminMediaUploadRequestConfig,
      ),
    },
    concepts: {
      remove: {
        hf: bindApiCall<
          AdminConceptsRemoveFromHFArguments,
          AdminConceptsRemoveFromHFArguments
        >(this, adminConceptsRemoveFromHFRequestConfig),
      },
      export: {
        hf: bindApiCall<
          AdminConceptsExportToHFArguments,
          AdminConceptsExportToHFArguments
        >(this, adminConceptsExportToHFRequestConfig),
      },
    },
    apikeys: {
      list: bindApiCall<AdminApiKeysListArguments, AdminApiKeysListResponse>(
        this,
        adminApiKeysListRequestConfig,
      ),
    },
  }

  public readonly apiKeys = {
    list: bindApiCall<ApiKeysListArguments, ApiKeysListResponse>(
      this,
      apiKeysListRequestConfig,
    ),
    create: bindApiCall<ApiKeysCreateArguments, ApiKeysCreateResponse>(
      this,
      apiKeysCreateRequestConfig,
    ),
    delete: bindApiCall<ApiKeysDeleteArguments, ApiKeysDeleteResponse>(
      this,
      apiKeysDeleteRequestConfig,
    ),
  }

  public readonly characters = {
    create: bindApiCall<CharactersCreateArguments, CharactersCreateResponse>(
      this,
      charactersCreateRequestConfig,
    ),
    update: bindApiCall<CharactersUpdateArguments, CharactersUpdateResponse>(
      this,
      charactersUpdateRequestConfig,
    ),
    delete: bindApiCall<CharactersDeleteArguments, CharactersDeleteResponse>(
      this,
      charactersDeleteRequestConfig,
    ),
    list: bindApiCall<CharactersListArguments, CharactersListResponse>(
      this,
      charactersListRequestConfig,
    ),
    get: bindApiCall<CharactersGetArguments, CharactersGetResponse>(
      this,
      charactersGetRequestConfig,
    ),
    test: bindApiCall<CharactersTestArguments, CharactersTestResponse>(
      this,
      charactersTestRequestConfig,
    ),
  }

  public readonly collections = {
    list: bindApiCall<CollectionsListArguments, CollectionsListResponse>(
      this,
      collectionsListRequestConfig,
    ),
    get: bindApiCall<CollectionsGetArguments, CollectionsGetResponse>(
      this,
      collectionsGetRequestConfig,
    ),
    getV2: bindApiCall<CollectionsV2GetArguments, CollectionsV2GetResponse>(
      this,
      collectionsV2GetRequestConfig,
    ),
    getCreationsV2: bindApiCall<
      CollectionsV2GetCreationsArguments,
      CollectionsV2GetCreationsResponse
    >(this, collectionsV2GetCreationsRequestConfig),
    getLightV2: bindApiCall<
      CollectionsV2GetLightArguments,
      CollectionsV2GetLightResponse
    >(this, collectionsV2GetLightRequestConfig),
    create: bindApiCall<CollectionsCreateArguments, CollectionsCreateResponse>(
      this,
      collectionsCreateRequestConfig,
    ),
    createV2: bindApiCall<
      CollectionsV2CreateArguments,
      CollectionsV2CreateResponse
    >(this, collectionsV2CreateRequestConfig),
    update: bindApiCall<CollectionsUpdateArguments, CollectionsUpdateResponse>(
      this,
      collectionsUpdateRequestConfig,
    ),
    delete: bindApiCall<CollectionsDeleteArguments, CollectionsDeleteResponse>(
      this,
      collectionsDeleteRequestConfig,
    ),
    creations: {
      add: bindApiCall<
        CollectionsAddCreationsArguments,
        CollectionsAddCreationsResponse
      >(this, collectionsAddCreationsRequestConfig),
      remove: bindApiCall<
        CollectionsRemoveCreationsArguments,
        CollectionsRemoveCreationsResponse
      >(this, collectionsRemoveCreationsRequestConfig),
      addV2: bindApiCall<
        CollectionsV2AddCreationsArguments,
        CollectionsV2AddCreationsResponse
      >(this, collectionsV2AddCreationsRequestConfig),
      removeV2: bindApiCall<
        CollectionsV2RemoveCreationsArguments,
        CollectionsV2RemoveCreationsResponse
      >(this, collectionsV2RemoveCreationsRequestConfig),
    },
    updateV2: bindApiCall<
      CollectionsV2UpdateArguments,
      CollectionsV2UpdateResponse
    >(this, collectionsV2UpdateRequestConfig),
    deleteV2: bindApiCall<
      CollectionsV2DeleteArguments,
      CollectionsV2DeleteResponse
    >(this, collectionsV2DeleteRequestConfig),
  }

  public readonly concepts = {
    list: bindApiCall<ConceptsListArguments, ConceptsListResponse>(
      this,
      conceptsListRequestConfig,
    ),
    get: bindApiCall<ConceptsGetArguments, ConceptsGetResponse>(
      this,
      conceptsGetRequestConfig,
    ),
    update: bindApiCall<ConceptsUpdateArguments, ConceptsUpdateResponse>(
      this,
      conceptsUpdateRequestConfig,
    ),
    delete: bindApiCall<ConceptsDeleteArguments, ConceptsDeleteResponse>(
      this,
      conceptsDeleteRequestConfig,
    ),
    react: bindApiCall<ConceptsReactArguments, ConceptsReactResponse>(
      this,
      conceptsReactRequestConfig,
    ),
    unreact: bindApiCall<ConceptsUnreactArguments, ConceptsUnreactResponse>(
      this,
      conceptsUnreactRequestConfig,
    ),
  }

  public readonly models = {
    list: bindApiCall<ModelsV2ListArguments, ModelsV2ListResponse>(
      this,
      modelsV2ListRequestConfig,
    ),
    get: bindApiCall<ModelsV2GetArguments, ModelsV2GetResponse>(
      this,
      modelsV2GetRequestConfig,
    ),
    update: bindApiCall<ModelsV2PatchArguments, ModelsV2PatchResponse>(
      this,
      modelsV2PatchRequestConfig,
    ),
    like: bindApiCall<ModelsV2LikeArguments, ModelsV2LikeResponse>(
      this,
      modelsV2LikeRequestConfig,
    ),
    unlike: bindApiCall<ModelsV2UnlikeArguments, ModelsV2UnlikeResponse>(
      this,
      modelsV2UnlikeRequestConfig,
    ),
    // delete: bindApiCall<ConceptsDeleteArguments, ConceptsDeleteResponse>(
    //   this,
    //   conceptsDeleteRequestConfig,
    // ),
    // react: bindApiCall<ConceptsReactArguments, ConceptsReactResponse>(
    //   this,
    //   conceptsReactRequestConfig,
    // ),
    // unreact: bindApiCall<ConceptsUnreactArguments, ConceptsUnreactResponse>(
    //   this,
    //   conceptsUnreactRequestConfig,
    // ),
  }

  public readonly notifications = {
    create: bindApiCall<
      NotificationsCreateArguments,
      NotificationsCreateResponse
    >(this, notificationsCreateRequestConfig),
    list: bindApiCall<NotificationsListArguments, NotificationsListResponse>(
      this,
      notificationsListRequestConfig,
    ),
    markRead: bindApiCall<
      NotificationsMarkReadArguments,
      NotificationsMarkReadResponse
    >(this, notificationsMarkReadRequestConfig),
    count: bindApiCall<NotificationsCountArguments, NotificationsCountResponse>(
      this,
      notificationsCountRequestConfig,
    ),
    archive: bindApiCall<
      NotificationsArchiveArguments,
      NotificationsArchiveResponse
    >(this, notificationsArchiveRequestConfig),
  }

  public readonly agents = {
    get: bindApiCall<AgentGetArguments, AgentGetResponse>(
      this,
      agentGetRequestConfig,
    ),
    create: bindApiCall<AgentsCreateArguments, AgentsCreateResponse>(
      this,
      agentsCreateRequestConfig,
    ),
    update: bindApiCall<AgentsUpdateArguments, AgentsUpdateResponse>(
      this,
      agentsUpdateRequestConfig,
    ),
    like: bindApiCall<AgentsLikeArguments, AgentsLikeResponse>(
      this,
      agentsLikeRequestConfig,
    ),
    unlike: bindApiCall<AgentsUnlikeArguments, AgentsUnlikeResponse>(
      this,
      agentsUnlikeRequestConfig,
    ),
    getDeployments: bindApiCall<
      AgentsGetDeploymentsArguments,
      AgentsGetDeploymentsResponse
    >(this, agentsGetDeploymentsRequestConfig),
    updateDeployment: bindApiCall<
      AgentsUpdateDeploymentArguments,
      AgentsUpdateDeploymentResponse
    >(this, agentsUpdateDeploymentRequestConfig),
    stopDeployment: bindApiCall<
      AgentsStopDeploymentArguments,
      AgentsStopDeploymentResponse
    >(this, agentsStopDeploymentRequestConfig),
    deploy: bindApiCall<AgentsDeployArguments, AgentsDeployResponse>(
      this,
      agentsDeployRequestConfig,
    ),
    deleteDeployment: bindApiCall<
      AgentsDeleteDeploymentArguments,
      AgentsDeleteDeploymentResponse
    >(this, agentsDeleteDeploymentRequestConfig),
    delete: bindApiCall<AgentsDeleteArguments, AgentsDeleteResponse>(
      this,
      agentsDeleteRequestConfig,
    ),
    getPermissions: bindApiCall<
      AgentsGetPermissionsArguments,
      AgentsGetPermissionsResponse
    >(this, agentsGetPermissionsRequestConfig),
    updatePermissions: bindApiCall<
      AgentsUpdatePermissionsArguments,
      AgentsUpdatePermissionsResponse
    >(this, agentsUpdatePermissionsRequestConfig),
    getShared: bindApiCall<
      AgentsGetSharedArguments,
      AgentsGetSharedResponse
    >(this, agentsGetSharedRequestConfig),
    triggers: {
      getAll: bindApiCall<
        AgentsGetTriggersArguments,
        AgentsGetTriggersResponse
      >(this, agentsGetTriggersRequestConfig),
      getAllUser: bindApiCall<
        AgentsGetAllTriggersArguments,
        AgentsGetAllTriggersResponse
      >(this, agentsGetAllTriggersRequestConfig),
      create: bindApiCall<
        AgentsCreateTriggerArguments,
        AgentsCreateTriggerResponse
      >(this, agentsCreateTriggerRequestConfig),
      update: bindApiCall<
        AgentsUpdateTriggerArguments,
        AgentsUpdateTriggerResponse
      >(this, agentsUpdateTriggerRequestConfig),
      delete: bindApiCall<
        AgentsDeleteTriggerArguments,
        AgentsDeleteTriggerResponse
      >(this, agentsDeleteTriggerRequestConfig),
    },
    deployments: {
      getAllUser: bindApiCall<
        AgentsGetAllDeploymentsArguments,
        AgentsGetAllDeploymentsResponse
      >(this, agentsGetAllDeploymentsRequestConfig),
    },
  }

  public readonly creations = {
    list: bindApiCall<CreationsListArguments, CreationsListResponse>(
      this,
      creationsListRequestConfig,
    ),
    get: bindApiCall<CreationsGetArguments, CreationsGetResponse>(
      this,
      creationsGetRequestConfig,
    ),
    getV2: bindApiCall<CreationsV2GetArguments, CreationsV2GetResponse>(
      this,
      creationsV2GetRequestConfig,
    ),
    react: bindApiCall<CreationsReactArguments, CreationsReactResponse>(
      this,
      creationsReactRequestConfig,
    ),
    unreact: bindApiCall<CreationsUnreactArguments, CreationsUnreactResponse>(
      this,
      creationsUnreactRequestConfig,
    ),
    update: bindApiCall<CreationsUpdateArguments, CreationsUpdateResponse>(
      this,
      creationsUpdateRequestConfig,
    ),
    updateV2: bindApiCall<CreationsV2PatchArguments, CreationsV2PatchResponse>(
      this,
      creationsV2PatchRequestConfig,
    ),
    bulkUpdateV2: bindApiCall<
      CreationsV2BulkPatchArguments,
      CreationsV2BulkPatchResponse
    >(this, creationsV2BulkPatchRequestConfig),
    delete: bindApiCall<CreationsDeleteArguments, CreationsDeleteResponse>(
      this,
      creationsDeleteRequestConfig,
    ),
    likeV2: bindApiCall<CreationsV2LikeArguments, CreationsV2LikeResponse>(
      this,
      creationsV2LikeRequestConfig,
    ),
    unlikeV2: bindApiCall<
      CreationsV2UnlikeArguments,
      CreationsV2UnlikeResponse
    >(this, creationsV2UnlikeRequestConfig),
  }

  public readonly creators = {
    follow: bindApiCall<CreatorsFollowArguments, CreatorsFollowResponse>(
      this,
      creatorsFollowRequestConfig,
    ),
    unfollow: bindApiCall<CreatorsUnfollowArguments, CreatorsUnfollowResponse>(
      this,
      creatorsUnfollowRequestConfig,
    ),
    list: bindApiCall<CreatorsListArguments, CreatorsListResponse>(
      this,
      creatorsListRequestConfig,
    ),
    get: bindApiCall<CreatorsGetArguments, CreatorsGetResponse>(
      this,
      creatorsGetRequestConfig,
    ),
    getV2: bindApiCall<CreatorsGetArguments, CreatorsGetResponse>(
      this,
      creatorsGetV2RequestConfig,
    ),
    update: bindApiCall<CreatorsUpdateArguments, CreatorsUpdateResponse>(
      this,
      creatorsUpdateRequestConfig,
    ),
    updateV2: bindApiCall<CreatorsUpdateArguments, CreatorsUpdateResponse>(
      this,
      creatorsUpdateV2RequestConfig,
    ),
    me: bindApiCall<WebAPICallOptions, CreatorsGetMeResponse>(
      this,
      creatorsGetMeRequestConfig,
    ),
    meV2: bindApiCall<WebAPICallOptions, CreatorsGetMeResponse>(
      this,
      creatorsGetMeV2RequestConfig,
    ),
  }

  public readonly creator = {
    followers: bindApiCall<
      CreatorFollowersListArguments,
      CreatorFollowersListResponse
    >(this, creatorFollowersListRequestConfig),

    following: bindApiCall<
      CreatorFollowersListArguments,
      CreatorFollowingListResponse
    >(this, creatorFollowingListRequestConfig),
  }

  public readonly feed = {
    creations: bindApiCall<FeedCreationsArguments, FeedCreationsResponse>(
      this,
      feedCreationsRequestConfig,
    ),
    concepts: bindApiCall<FeedConceptsArguments, FeedConceptsResponse>(
      this,
      feedConceptsRequestConfig,
    ),
  }

  public readonly feed_cursor = {
    creations: bindApiCall<
      FeedCreationsCursorArguments,
      FeedCreationsCursorResponse
    >(this, feedCursorCreationsRequestConfig),
  }

  public readonly feed_cursorV2 = {
    creations: bindApiCall<
      FeedCreationsV2CursorArguments,
      FeedCreationsV2CursorResponse
    >(this, feedCursorCreationsV2RequestConfig),
  }

  public readonly generators = {
    list: bindApiCall<GeneratorsListArguments, GeneratorsListResponse>(
      this,
      generatorsListRequestConfig,
    ),
    get: bindApiCall<GeneratorsGetArguments, GeneratorsGetResponse>(
      this,
      generatorsGetRequestConfig,
    ),
  }

  public readonly tools = {
    list: bindApiCall<ToolsListArgumentsV2, ToolsListResponseV2>(
      this,
      toolsListRequestConfigV2,
    ),
    get: bindApiCall<ToolsGetArgumentsV2, ToolsGetResponseV2>(
      this,
      toolsGetRequestConfigV2,
    ),
  }

  public readonly manna = {
    balance: bindApiCall<MannaBalanceGetArguments, MannaBalanceGetResponse>(
      this,
      mannaBalanceGetRequestConfig,
    ),
    vouchers: {
      redeem: bindApiCall<
        MannaVouchersRedeemArguments,
        MannaVoucherRedeemResponse
      >(this, mannaVouchersRedeemRequestConfig),
    },
  }

  public readonly media = {
    upload: bindApiCall<MediaUploadArguments, MediaUploadResponse>(
      this,
      mediaUploadRequestConfig,
    ),
    bulkDownload: bindApiCall<
      MediaBulkDownloadArguments,
      MediaBulkDownloadResponse
    >(this, mediaBulkDownloadRequestConfig),
  }

  public readonly payments = {
    create: bindApiCall<PaymentsCreateArguments, PaymentsCreateResponse>(
      this,
      paymentsCreateRequestConfig,
    ),
    products: bindApiCall<WebAPICallOptions, PaymentsProductsResponse>(
      this,
      paymentsProductsRequestConfig,
    ),
    subscription: bindApiCall<
      PaymentsSubscriptionArguments,
      PaymentsSubscriptionResponse
    >(this, paymentsSubscriptionRequestConfig),
  }

  public readonly sessions = {
    create: bindApiCall<WebAPICallOptions, SessionsCreateResponse>(
      this,
      sessionsCreateRequestConfig,
    ),
    delete: bindApiCall<SessionsDeleteArguments, SessionsDeleteResponse>(
      this,
      sessionsDeleteRequestConfig,
    ),
    list: bindApiCall<SessionsListArguments, SessionsListResponse>(
      this,
      sessionsListRequestConfig,
    ),
    get: bindApiCall<SessionsGetArguments, SessionsGetResponse>(
      this,
      sessionsGetRequestConfig,
    ),
    interact: bindApiCall<SessionsInteractArguments, SessionsInteractResponse>(
      this,
      sessionsInteractRequestConfig,
    ),
    users: {
      add: bindApiCall<SessionsAddUsersArguments, SessionsAddUsersResponse>(
        this,
        sessionsAddUsersRequestConfig,
      ),
    },
    characters: {
      add: bindApiCall<
        SessionsAddCharactersArguments,
        SessionsAddCharactersResponse
      >(this, sessionsAddCharactersRequestConfig),
    },
    v2: {
      list: bindApiCall<SessionsV2ListArguments, SessionsV2ListResponse>(
        this,
        sessionsListRequestConfigV2,
      ),
      get: bindApiCall<SessionsV2GetArguments, SessionsV2GetResponse>(
        this,
        sessionsGetRequestConfigV2,
      ),
      react: bindApiCall<
        SessionsV2MessageReactArguments,
        SessionsV2MessageReactResponse
      >(this, sessionsMessageReactRequestConfigV2),
      message: bindApiCall<
        SessionsV2MessageArguments,
        SessionsV2MessageResponse
      >(this, sessionsMessageRequestConfigV2),
      rename: bindApiCall<SessionsV2RenameArguments, SessionsV2RenameResponse>(
        this,
        sessionsRenameRequestConfigV2,
      ),
      delete: bindApiCall<SessionsV2DeleteArguments, SessionsV2DeleteResponse>(
        this,
        sessionsDeleteRequestConfigV2,
      ),
      create: bindApiCall<SessionsV2CreateArguments, SessionsV2CreateResponse>(
        this,
        sessionsCreateRequestConfigV2,
      ),
      cancel: bindApiCall<SessionsV2CancelArguments, SessionsV2CancelResponse>(
        this,
        sessionsCancelRequestConfigV2,
      ),
      share: {
        create: bindApiCall<
          SessionsV2ShareCreateArguments,
          SessionsV2ShareCreateResponse
        >(this, sessionsShareCreateRequestConfigV2),
        delete: bindApiCall<
          SessionsV2ShareDeleteArguments,
          SessionsV2ShareDeleteResponse
        >(this, sessionsShareDeleteRequestConfigV2),
        get: bindApiCall<
          SessionsV2ShareGetArguments,
          SessionsV2ShareGetResponse
        >(this, sessionsShareGetRequestConfigV2),
      },
    },
  }

  public readonly session = {
    events: {
      list: bindApiCall<SessionEventsListArguments, SessionEventsListResponse>(
        this,
        sessionEventsListRequestConfig,
      ),
    },
  }

  public readonly threads = {
    create: bindApiCall<ThreadsCreateArguments, ThreadsCreateResponse>(
      this,
      threadsCreateRequestConfig,
    ),
    get: bindApiCall<ThreadsGetArguments, ThreadsGetResponse>(
      this,
      threadsGetRequestConfig,
    ),
    list: bindApiCall<ThreadsListArguments, ThreadsListResponse>(
      this,
      threadsListRequestConfig,
    ),
    message: bindApiCall<ThreadsMessageArguments, ThreadsMessageResponse>(
      this,
      threadsMessageRequestConfig,
    ),
    react: bindApiCall<
      ThreadsMessageReactArguments,
      ThreadsMessageReactResponse
    >(this, threadsMessageReactRequestConfig),
    pinMessage: bindApiCall<
      ThreadsPinMessageArguments,
      ThreadsPinMessageResponse
    >(this, threadsPinMessageRequestConfig),
    unpinMessage: bindApiCall<
      ThreadsUnpinMessageArguments,
      ThreadsUnpinMessageResponse
    >(this, threadsUnpinMessageRequestConfig),
    delete: bindApiCall<ThreadsDeleteArguments, ThreadsDeleteResponse>(
      this,
      threadsDeleteRequestConfig,
    ),
    rename: bindApiCall<ThreadsRenameArguments, ThreadsRenameResponse>(
      this,
      threadsRenameRequestConfig,
    ),
  }

  public readonly tasks = {
    create: bindApiCall<TasksCreateArguments, TasksCreateResponse>(
      this,
      tasksCreateRequestConfig,
    ),
    createV2: bindApiCall<TasksV2CreateArguments, TasksV2CreateResponse>(
      this,
      tasksV2CreateRequestConfig,
    ),
    cost: bindApiCall<TasksCreateArguments, TasksCreateResponse>(
      this,
      tasksCostRequestConfig,
    ),
    costV2: bindApiCall<TasksV2CreateArguments, TasksV2CreateResponse>(
      this,
      tasksV2CostRequestConfig,
    ),
    get: bindApiCall<TasksGetArguments, TasksGetResponse>(
      this,
      tasksGetRequestConfig,
    ),
    getV2: bindApiCall<TasksV2GetArguments, TasksV2GetResponse>(
      this,
      tasksV2GetRequestConfig,
    ),
    list: bindApiCall<TasksListArguments, TasksListResponse>(
      this,
      tasksListRequestConfig,
    ),
    listV2: bindApiCall<TasksV2ListArguments, TasksV2ListResponse>(
      this,
      tasksV2ListRequestConfig,
    ),
    cancelV2: bindApiCall<TasksV2CancelArguments, TasksV2CancelResponse>(
      this,
      tasksV2CancelRequestConfig,
    ),
  }
}
