import { Methods } from "./methods";
import { TasksCreateArguments } from "./models";
import { TaskV2, TasksV2CreateArguments } from "./models/v2";
import {
  TaskUpdateEvent,
  WebAPICallOptions,
  WebAPICallResult,
  WebClientOptions,
} from "./types";
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import EventSourcePolyfill from "event-source-polyfill";

// Instead of using require, we'll handle Node.js EventSource differently
let NodeEventSource: any = null;
if (typeof process !== "undefined" && process.release?.name === "node") {
  // In Node.js environment, dynamically import eventsource
  import("eventsource")
    .then((module) => {
      NodeEventSource = module.default;
    })
    .catch(() => {
      // If import fails, fallback to polyfill
      NodeEventSource = EventSourcePolyfill;
    });
}

interface AsyncIteratorResult {
  value: TaskUpdateEvent;
  done: boolean;
}

export class EdenClient extends Methods {
  public readonly edenApiUrl: string;
  public readonly token?: string;
  public readonly apiKey?: string;
  private axios: AxiosInstance;

  public constructor({
    edenApiUrl = "https://api.eden.art",
    token = undefined,
    apiKey = undefined,
  }: WebClientOptions = {}) {
    super();

    this.token = token;
    this.apiKey = apiKey;
    this.edenApiUrl = edenApiUrl;

    this.axios = axios.create({
      baseURL: edenApiUrl,
    });
  }

  public subscribe(taskId?: string, edenVersion?: "v2") {
    const headers = {
      "X-Api-Key": this.apiKey,
    };
    const query = taskId ? `?taskId=${taskId}` : "";

    const isNodeEnvironment =
      typeof process !== "undefined" &&
      process.release &&
      process.release.name === "node";

    // Use the appropriate EventSource implementation
    const EventSource =
      isNodeEnvironment && NodeEventSource
        ? NodeEventSource
        : EventSourcePolyfill;

    const endpointSSE = `${this.edenApiUrl}${
      edenVersion ? `/${edenVersion}` : ""
    }/tasks/events${query}`;

    console.log({ endpointSSE });

    const eventSource = new EventSource(endpointSSE, { headers });

    const eventIterable = {
      [Symbol.asyncIterator]: () => {
        const queue: TaskUpdateEvent[] = [];
        let resolver: ((value: AsyncIteratorResult) => void) | null;

        eventSource.addEventListener("task-update", (event: any) => {
          // console.log(
          //   'eventSource event handler',
          //   'task-update',
          //   edenVersion,
          //   event,
          // )

          if (event && event.data) {
            const data = JSON.parse(event.data);
            console.log(
              event.type,
              edenVersion,
              taskId,
              data.taskId,
              data._id,
              data.status
            );
            const eventTaskId = data
              ? data.taskId
                ? data.taskId
                : data._id
              : undefined;
            if (eventTaskId === taskId) {
              if (resolver) {
                resolver({ value: data as TaskUpdateEvent, done: false });
                resolver = null;
              } else {
                queue.push(data as TaskUpdateEvent);
              }
            }
          }
        });

        eventSource.onerror = (error: any) => {
          console.error("EventSource error:", error);
          eventSource.close();
          if (resolver) {
            // Propagate error by resolving with a rejected promise wrapped in value
            // (consumer should handle try/catch around for-await loop)
            resolver = null;
          }
        };

        return {
          next(): Promise<AsyncIteratorResult> {
            if (queue.length > 0) {
              const value = queue.shift() as TaskUpdateEvent;
              return Promise.resolve({ value, done: false });
            }
            return new Promise<AsyncIteratorResult>((resolve) => {
              resolver = resolve;
            });
          },
        };
      },
      close: () => {
        console.log("closing eventsource.");
        eventSource.close();
      },
    };

    return eventIterable;
  }

  async create(args: TasksCreateArguments) {
    // Submit the task and get the ID
    const { taskId } = await this.tasks.create(args);

    // Subscribe to task updates
    const subscription = this.subscribe(taskId);
    try {
      for await (const event of subscription) {
        if (event.status === "completed" || event.status === "error") {
          return event.result;
        }
      }
    } catch (error) {
      console.error("Error during subscription:", error);
    } finally {
      // Close the subscription
      if (subscription.close) {
        // console.log('closing subscription')
        subscription.close();
      }
    }
  }

  async createV2(args: TasksV2CreateArguments, awaitResult: boolean = true) {
    // Submit the task and get the ID
    const res = await this.tasks.createV2(args);
    const { task, timing } = (res as { task: TaskV2; timing: string }) || {};

    if (!task) {
      const { error, message } = res;
      throw new Error(`Failed to create task - Reason: ${message || error}`);
    }

    if (!awaitResult) {
      return { ...task, timing };
    }

    // Subscribe to task updates
    const subscription = this.subscribe(task._id, "v2");
    try {
      for await (const event of subscription) {
        console.log("processing taskupdateEvent", event);

        if (event.status === "completed" || event.status === "failed") {
          return event.result;
        }
      }
    } catch (error) {
      console.error("Error during subscription:", error);
    } finally {
      // Close the subscription
      if (subscription.close) {
        // console.log('closing subscription')
        subscription.close();
      }
    }
  }

  public async apiCall(
    configFn: (options: WebAPICallOptions) => AxiosRequestConfig,
    options: WebAPICallOptions = {}
  ): Promise<WebAPICallResult> {
    const headers: Record<string, string> = {};
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    if (this.apiKey) {
      headers["X-Api-Key"] = this.apiKey as string;
    }
    const requestConfig = configFn(options);
    requestConfig.headers = headers;
    requestConfig.signal = AbortSignal.timeout(50 * 60 * 1000);
    // requestConfig.baseURL = this.edenApiUrl

    const response = await this.makeRequest(requestConfig);
    const result = await this.buildResult(response);
    return result;
  }

  private async makeRequest(
    requestConfig: AxiosRequestConfig
  ): Promise<AxiosResponse> {
    return this.axios.request(requestConfig);
  }

  private async buildResult(
    response: AxiosResponse
  ): Promise<WebAPICallResult> {
    const result = response.data;
    return { ...result, timing: response.headers["server-timing"] || "" };
  }
}
