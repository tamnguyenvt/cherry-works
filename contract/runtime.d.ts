// The library's declarations from runtime, split from dist/index.d.ts for reading.

/** Every schema of this module's DTOs, under its name — the name it carries
 *  as `type` — in alphabetical order. */
declare const RuntimeDTOs: {
  EvalCaseReport: z.ZodObject<
    {
      type: z.ZodLiteral<"EvalCaseReport">;
      data: z.ZodObject<
        {
          suiteName: z.ZodString;
          prompt: z.ZodString;
          passed: z.ZodBoolean;
          tokens: z.ZodNumber;
          unmetReasons: z.ZodReadonly<z.ZodArray<z.ZodString>>;
          logPath: z.ZodOptional<z.ZodString>;
          sessionId: z.ZodOptional<z.ZodString>;
          sessionPath: z.ZodOptional<z.ZodString>;
        },
        z.core.$strip
      >;
    },
    z.core.$strip
  > & {
    of: (dataValue: {
      suiteName: string;
      prompt: string;
      passed: boolean;
      tokens: number;
      unmetReasons: readonly string[];
      logPath?: string | undefined;
      sessionId?: string | undefined;
      sessionPath?: string | undefined;
    }) => {
      type: "EvalCaseReport";
      data: {
        suiteName: string;
        prompt: string;
        passed: boolean;
        tokens: number;
        unmetReasons: readonly string[];
        logPath?: string | undefined;
        sessionId?: string | undefined;
        sessionPath?: string | undefined;
      };
    };
  };
  EvalRunReport: z.ZodObject<
    {
      type: z.ZodLiteral<"EvalRunReport">;
      data: z.ZodObject<
        {
          agent: z.ZodString;
          evalCaseReports: z.ZodReadonly<
            z.ZodArray<
              z.ZodObject<
                {
                  type: z.ZodLiteral<"EvalCaseReport">;
                  data: z.ZodObject<
                    {
                      suiteName: z.ZodString;
                      prompt: z.ZodString;
                      passed: z.ZodBoolean;
                      tokens: z.ZodNumber;
                      unmetReasons: z.ZodReadonly<z.ZodArray<z.ZodString>>;
                      logPath: z.ZodOptional<z.ZodString>;
                      sessionId: z.ZodOptional<z.ZodString>;
                      sessionPath: z.ZodOptional<z.ZodString>;
                    },
                    z.core.$strip
                  >;
                },
                z.core.$strip
              > & {
                of: (dataValue: {
                  suiteName: string;
                  prompt: string;
                  passed: boolean;
                  tokens: number;
                  unmetReasons: readonly string[];
                  logPath?: string | undefined;
                  sessionId?: string | undefined;
                  sessionPath?: string | undefined;
                }) => {
                  type: "EvalCaseReport";
                  data: {
                    suiteName: string;
                    prompt: string;
                    passed: boolean;
                    tokens: number;
                    unmetReasons: readonly string[];
                    logPath?: string | undefined;
                    sessionId?: string | undefined;
                    sessionPath?: string | undefined;
                  };
                };
              }
            >
          >;
          totalTokens: z.ZodNumber;
        },
        z.core.$strip
      >;
    },
    z.core.$strip
  > & {
    of: (dataValue: {
      agent: string;
      evalCaseReports: readonly {
        type: "EvalCaseReport";
        data: {
          suiteName: string;
          prompt: string;
          passed: boolean;
          tokens: number;
          unmetReasons: readonly string[];
          logPath?: string | undefined;
          sessionId?: string | undefined;
          sessionPath?: string | undefined;
        };
      }[];
      totalTokens: number;
    }) => {
      type: "EvalRunReport";
      data: {
        agent: string;
        evalCaseReports: readonly {
          type: "EvalCaseReport";
          data: {
            suiteName: string;
            prompt: string;
            passed: boolean;
            tokens: number;
            unmetReasons: readonly string[];
            logPath?: string | undefined;
            sessionId?: string | undefined;
            sessionPath?: string | undefined;
          };
        }[];
        totalTokens: number;
      };
    };
  };
  EvalLogAnalysis: z.ZodObject<
    {
      type: z.ZodLiteral<"EvalLogAnalysis">;
      data: z.ZodObject<
        {
          logs: z.ZodReadonly<
            z.ZodArray<
              z.ZodObject<
                {
                  logPath: z.ZodString;
                  createdAt: z.ZodString;
                  agent: z.ZodString;
                  prompt: z.ZodString;
                  workingFolderPath: z.ZodString;
                  outputPath: z.ZodString;
                  stdoutPath: z.ZodString;
                  stderrPath: z.ZodString;
                  success: z.ZodBoolean;
                  totalTokens: z.ZodNumber;
                  unmetReasons: z.ZodReadonly<z.ZodArray<z.ZodString>>;
                  answer: z.ZodString;
                  toolCalls: z.ZodReadonly<z.ZodArray<z.ZodString>>;
                  sessionId: z.ZodOptional<z.ZodString>;
                  sessionPath: z.ZodOptional<z.ZodString>;
                  error: z.ZodOptional<z.ZodString>;
                },
                z.core.$strip
              >
            >
          >;
        },
        z.core.$strip
      >;
    },
    z.core.$strip
  > & {
    of: (dataValue: {
      logs: readonly {
        logPath: string;
        createdAt: string;
        agent: string;
        prompt: string;
        workingFolderPath: string;
        outputPath: string;
        stdoutPath: string;
        stderrPath: string;
        success: boolean;
        totalTokens: number;
        unmetReasons: readonly string[];
        answer: string;
        toolCalls: readonly string[];
        sessionId?: string | undefined;
        sessionPath?: string | undefined;
        error?: string | undefined;
      }[];
    }) => {
      type: "EvalLogAnalysis";
      data: {
        logs: readonly {
          logPath: string;
          createdAt: string;
          agent: string;
          prompt: string;
          workingFolderPath: string;
          outputPath: string;
          stdoutPath: string;
          stderrPath: string;
          success: boolean;
          totalTokens: number;
          unmetReasons: readonly string[];
          answer: string;
          toolCalls: readonly string[];
          sessionId?: string | undefined;
          sessionPath?: string | undefined;
          error?: string | undefined;
        }[];
      };
    };
  };
  ToolAnswer: z.ZodObject<
    {
      type: z.ZodLiteral<"ToolAnswer">;
      data: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    },
    z.core.$strip
  > & {
    of: (dataValue: Record<string, unknown>) => {
      type: "ToolAnswer";
      data: Record<string, unknown>;
    };
  };
  SessionSummary: z.ZodObject<
    {
      type: z.ZodLiteral<"SessionSummary">;
      data: z.ZodObject<
        {
          span: z.ZodObject<
            {
              since: z.ZodString;
              until: z.ZodString;
            },
            z.core.$strip
          >;
          sessions: z.ZodReadonly<
            z.ZodArray<
              z.ZodObject<
                {
                  sessionId: z.ZodString;
                  model: z.ZodString;
                  lastStopAt: z.ZodString;
                  tokens: z.ZodObject<
                    {
                      input: z.ZodNumber;
                      output: z.ZodNumber;
                      cacheWrite: z.ZodNumber;
                      cacheRead: z.ZodNumber;
                    },
                    z.core.$strip
                  >;
                  totalTokens: z.ZodNumber;
                },
                z.core.$strip
              >
            >
          >;
          sessionCount: z.ZodNumber;
          totalTokens: z.ZodNumber;
        },
        z.core.$strip
      >;
    },
    z.core.$strip
  > & {
    of: (dataValue: {
      span: {
        since: string;
        until: string;
      };
      sessions: readonly {
        sessionId: string;
        model: string;
        lastStopAt: string;
        tokens: {
          input: number;
          output: number;
          cacheWrite: number;
          cacheRead: number;
        };
        totalTokens: number;
      }[];
      sessionCount: number;
      totalTokens: number;
    }) => {
      type: "SessionSummary";
      data: {
        span: {
          since: string;
          until: string;
        };
        sessions: readonly {
          sessionId: string;
          model: string;
          lastStopAt: string;
          tokens: {
            input: number;
            output: number;
            cacheWrite: number;
            cacheRead: number;
          };
          totalTokens: number;
        }[];
        sessionCount: number;
        totalTokens: number;
      };
    };
  };
  SessionReviewOutcome: z.ZodObject<
    {
      type: z.ZodLiteral<"SessionReviewOutcome">;
      data: z.ZodObject<
        {
          sessionsFolder: z.ZodString;
          sessionSummary: z.ZodObject<
            {
              type: z.ZodLiteral<"SessionSummary">;
              data: z.ZodObject<
                {
                  span: z.ZodObject<
                    {
                      since: z.ZodString;
                      until: z.ZodString;
                    },
                    z.core.$strip
                  >;
                  sessions: z.ZodReadonly<
                    z.ZodArray<
                      z.ZodObject<
                        {
                          sessionId: z.ZodString;
                          model: z.ZodString;
                          lastStopAt: z.ZodString;
                          tokens: z.ZodObject<
                            {
                              input: z.ZodNumber;
                              output: z.ZodNumber;
                              cacheWrite: z.ZodNumber;
                              cacheRead: z.ZodNumber;
                            },
                            z.core.$strip
                          >;
                          totalTokens: z.ZodNumber;
                        },
                        z.core.$strip
                      >
                    >
                  >;
                  sessionCount: z.ZodNumber;
                  totalTokens: z.ZodNumber;
                },
                z.core.$strip
              >;
            },
            z.core.$strip
          > & {
            of: (dataValue: {
              span: {
                since: string;
                until: string;
              };
              sessions: readonly {
                sessionId: string;
                model: string;
                lastStopAt: string;
                tokens: {
                  input: number;
                  output: number;
                  cacheWrite: number;
                  cacheRead: number;
                };
                totalTokens: number;
              }[];
              sessionCount: number;
              totalTokens: number;
            }) => {
              type: "SessionSummary";
              data: {
                span: {
                  since: string;
                  until: string;
                };
                sessions: readonly {
                  sessionId: string;
                  model: string;
                  lastStopAt: string;
                  tokens: {
                    input: number;
                    output: number;
                    cacheWrite: number;
                    cacheRead: number;
                  };
                  totalTokens: number;
                }[];
                sessionCount: number;
                totalTokens: number;
              };
            };
          };
          dailySessionSummary: z.ZodRecord<
            z.ZodString,
            z.ZodObject<
              {
                type: z.ZodLiteral<"SessionSummary">;
                data: z.ZodObject<
                  {
                    span: z.ZodObject<
                      {
                        since: z.ZodString;
                        until: z.ZodString;
                      },
                      z.core.$strip
                    >;
                    sessions: z.ZodReadonly<
                      z.ZodArray<
                        z.ZodObject<
                          {
                            sessionId: z.ZodString;
                            model: z.ZodString;
                            lastStopAt: z.ZodString;
                            tokens: z.ZodObject<
                              {
                                input: z.ZodNumber;
                                output: z.ZodNumber;
                                cacheWrite: z.ZodNumber;
                                cacheRead: z.ZodNumber;
                              },
                              z.core.$strip
                            >;
                            totalTokens: z.ZodNumber;
                          },
                          z.core.$strip
                        >
                      >
                    >;
                    sessionCount: z.ZodNumber;
                    totalTokens: z.ZodNumber;
                  },
                  z.core.$strip
                >;
              },
              z.core.$strip
            > & {
              of: (dataValue: {
                span: {
                  since: string;
                  until: string;
                };
                sessions: readonly {
                  sessionId: string;
                  model: string;
                  lastStopAt: string;
                  tokens: {
                    input: number;
                    output: number;
                    cacheWrite: number;
                    cacheRead: number;
                  };
                  totalTokens: number;
                }[];
                sessionCount: number;
                totalTokens: number;
              }) => {
                type: "SessionSummary";
                data: {
                  span: {
                    since: string;
                    until: string;
                  };
                  sessions: readonly {
                    sessionId: string;
                    model: string;
                    lastStopAt: string;
                    tokens: {
                      input: number;
                      output: number;
                      cacheWrite: number;
                      cacheRead: number;
                    };
                    totalTokens: number;
                  }[];
                  sessionCount: number;
                  totalTokens: number;
                };
              };
            }
          >;
        },
        z.core.$strip
      >;
    },
    z.core.$strip
  > & {
    of: (dataValue: {
      sessionsFolder: string;
      sessionSummary: {
        type: "SessionSummary";
        data: {
          span: {
            since: string;
            until: string;
          };
          sessions: readonly {
            sessionId: string;
            model: string;
            lastStopAt: string;
            tokens: {
              input: number;
              output: number;
              cacheWrite: number;
              cacheRead: number;
            };
            totalTokens: number;
          }[];
          sessionCount: number;
          totalTokens: number;
        };
      };
      dailySessionSummary: Record<
        string,
        {
          type: "SessionSummary";
          data: {
            span: {
              since: string;
              until: string;
            };
            sessions: readonly {
              sessionId: string;
              model: string;
              lastStopAt: string;
              tokens: {
                input: number;
                output: number;
                cacheWrite: number;
                cacheRead: number;
              };
              totalTokens: number;
            }[];
            sessionCount: number;
            totalTokens: number;
          };
        }
      >;
    }) => {
      type: "SessionReviewOutcome";
      data: {
        sessionsFolder: string;
        sessionSummary: {
          type: "SessionSummary";
          data: {
            span: {
              since: string;
              until: string;
            };
            sessions: readonly {
              sessionId: string;
              model: string;
              lastStopAt: string;
              tokens: {
                input: number;
                output: number;
                cacheWrite: number;
                cacheRead: number;
              };
              totalTokens: number;
            }[];
            sessionCount: number;
            totalTokens: number;
          };
        };
        dailySessionSummary: Record<
          string,
          {
            type: "SessionSummary";
            data: {
              span: {
                since: string;
                until: string;
              };
              sessions: readonly {
                sessionId: string;
                model: string;
                lastStopAt: string;
                tokens: {
                  input: number;
                  output: number;
                  cacheWrite: number;
                  cacheRead: number;
                };
                totalTokens: number;
              }[];
              sessionCount: number;
              totalTokens: number;
            };
          }
        >;
      };
    };
  };
  SensorRunOutcome: z.ZodObject<
    {
      type: z.ZodLiteral<"SensorRunOutcome">;
      data: z.ZodObject<
        {
          exitCode: z.ZodNumber;
          answer: z.ZodString;
          problem: z.ZodString;
        },
        z.core.$strip
      >;
    },
    z.core.$strip
  > & {
    of: (dataValue: { exitCode: number; answer: string; problem: string }) => {
      type: "SensorRunOutcome";
      data: {
        exitCode: number;
        answer: string;
        problem: string;
      };
    };
  };
  MainContextLoad: z.ZodObject<
    {
      type: z.ZodLiteral<"MainContextLoad">;
      data: z.ZodObject<
        {
          id: z.ZodString;
          kind: z.ZodString;
          tokens: z.ZodNumber;
          globs: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
        },
        z.core.$strip
      >;
    },
    z.core.$strip
  > & {
    of: (dataValue: { id: string; kind: string; tokens: number; globs?: readonly string[] | undefined }) => {
      type: "MainContextLoad";
      data: {
        id: string;
        kind: string;
        tokens: number;
        globs?: readonly string[] | undefined;
      };
    };
  };
  MainContext: z.ZodObject<
    {
      type: z.ZodLiteral<"MainContext">;
      data: z.ZodObject<
        {
          agent: z.ZodString;
          isExact: z.ZodBoolean;
          sessionLoads: z.ZodReadonly<
            z.ZodArray<
              z.ZodObject<
                {
                  type: z.ZodLiteral<"MainContextLoad">;
                  data: z.ZodObject<
                    {
                      id: z.ZodString;
                      kind: z.ZodString;
                      tokens: z.ZodNumber;
                      globs: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
                    },
                    z.core.$strip
                  >;
                },
                z.core.$strip
              > & {
                of: (dataValue: {
                  id: string;
                  kind: string;
                  tokens: number;
                  globs?: readonly string[] | undefined;
                }) => {
                  type: "MainContextLoad";
                  data: {
                    id: string;
                    kind: string;
                    tokens: number;
                    globs?: readonly string[] | undefined;
                  };
                };
              }
            >
          >;
          fileLoads: z.ZodReadonly<
            z.ZodArray<
              z.ZodObject<
                {
                  type: z.ZodLiteral<"MainContextLoad">;
                  data: z.ZodObject<
                    {
                      id: z.ZodString;
                      kind: z.ZodString;
                      tokens: z.ZodNumber;
                      globs: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
                    },
                    z.core.$strip
                  >;
                },
                z.core.$strip
              > & {
                of: (dataValue: {
                  id: string;
                  kind: string;
                  tokens: number;
                  globs?: readonly string[] | undefined;
                }) => {
                  type: "MainContextLoad";
                  data: {
                    id: string;
                    kind: string;
                    tokens: number;
                    globs?: readonly string[] | undefined;
                  };
                };
              }
            >
          >;
          totalTokens: z.ZodNumber;
        },
        z.core.$strip
      >;
    },
    z.core.$strip
  > & {
    of: (dataValue: {
      agent: string;
      isExact: boolean;
      sessionLoads: readonly {
        type: "MainContextLoad";
        data: {
          id: string;
          kind: string;
          tokens: number;
          globs?: readonly string[] | undefined;
        };
      }[];
      fileLoads: readonly {
        type: "MainContextLoad";
        data: {
          id: string;
          kind: string;
          tokens: number;
          globs?: readonly string[] | undefined;
        };
      }[];
      totalTokens: number;
    }) => {
      type: "MainContext";
      data: {
        agent: string;
        isExact: boolean;
        sessionLoads: readonly {
          type: "MainContextLoad";
          data: {
            id: string;
            kind: string;
            tokens: number;
            globs?: readonly string[] | undefined;
          };
        }[];
        fileLoads: readonly {
          type: "MainContextLoad";
          data: {
            id: string;
            kind: string;
            tokens: number;
            globs?: readonly string[] | undefined;
          };
        }[];
        totalTokens: number;
      };
    };
  };
  MainContexts: z.ZodObject<
    {
      type: z.ZodLiteral<"MainContexts">;
      data: z.ZodObject<
        {
          contexts: z.ZodReadonly<
            z.ZodArray<
              z.ZodObject<
                {
                  type: z.ZodLiteral<"MainContext">;
                  data: z.ZodObject<
                    {
                      agent: z.ZodString;
                      isExact: z.ZodBoolean;
                      sessionLoads: z.ZodReadonly<
                        z.ZodArray<
                          z.ZodObject<
                            {
                              type: z.ZodLiteral<"MainContextLoad">;
                              data: z.ZodObject<
                                {
                                  id: z.ZodString;
                                  kind: z.ZodString;
                                  tokens: z.ZodNumber;
                                  globs: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
                                },
                                z.core.$strip
                              >;
                            },
                            z.core.$strip
                          > & {
                            of: (dataValue: {
                              id: string;
                              kind: string;
                              tokens: number;
                              globs?: readonly string[] | undefined;
                            }) => {
                              type: "MainContextLoad";
                              data: {
                                id: string;
                                kind: string;
                                tokens: number;
                                globs?: readonly string[] | undefined;
                              };
                            };
                          }
                        >
                      >;
                      fileLoads: z.ZodReadonly<
                        z.ZodArray<
                          z.ZodObject<
                            {
                              type: z.ZodLiteral<"MainContextLoad">;
                              data: z.ZodObject<
                                {
                                  id: z.ZodString;
                                  kind: z.ZodString;
                                  tokens: z.ZodNumber;
                                  globs: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
                                },
                                z.core.$strip
                              >;
                            },
                            z.core.$strip
                          > & {
                            of: (dataValue: {
                              id: string;
                              kind: string;
                              tokens: number;
                              globs?: readonly string[] | undefined;
                            }) => {
                              type: "MainContextLoad";
                              data: {
                                id: string;
                                kind: string;
                                tokens: number;
                                globs?: readonly string[] | undefined;
                              };
                            };
                          }
                        >
                      >;
                      totalTokens: z.ZodNumber;
                    },
                    z.core.$strip
                  >;
                },
                z.core.$strip
              > & {
                of: (dataValue: {
                  agent: string;
                  isExact: boolean;
                  sessionLoads: readonly {
                    type: "MainContextLoad";
                    data: {
                      id: string;
                      kind: string;
                      tokens: number;
                      globs?: readonly string[] | undefined;
                    };
                  }[];
                  fileLoads: readonly {
                    type: "MainContextLoad";
                    data: {
                      id: string;
                      kind: string;
                      tokens: number;
                      globs?: readonly string[] | undefined;
                    };
                  }[];
                  totalTokens: number;
                }) => {
                  type: "MainContext";
                  data: {
                    agent: string;
                    isExact: boolean;
                    sessionLoads: readonly {
                      type: "MainContextLoad";
                      data: {
                        id: string;
                        kind: string;
                        tokens: number;
                        globs?: readonly string[] | undefined;
                      };
                    }[];
                    fileLoads: readonly {
                      type: "MainContextLoad";
                      data: {
                        id: string;
                        kind: string;
                        tokens: number;
                        globs?: readonly string[] | undefined;
                      };
                    }[];
                    totalTokens: number;
                  };
                };
              }
            >
          >;
        },
        z.core.$strip
      >;
    },
    z.core.$strip
  > & {
    of: (dataValue: {
      contexts: readonly {
        type: "MainContext";
        data: {
          agent: string;
          isExact: boolean;
          sessionLoads: readonly {
            type: "MainContextLoad";
            data: {
              id: string;
              kind: string;
              tokens: number;
              globs?: readonly string[] | undefined;
            };
          }[];
          fileLoads: readonly {
            type: "MainContextLoad";
            data: {
              id: string;
              kind: string;
              tokens: number;
              globs?: readonly string[] | undefined;
            };
          }[];
          totalTokens: number;
        };
      }[];
    }) => {
      type: "MainContexts";
      data: {
        contexts: readonly {
          type: "MainContext";
          data: {
            agent: string;
            isExact: boolean;
            sessionLoads: readonly {
              type: "MainContextLoad";
              data: {
                id: string;
                kind: string;
                tokens: number;
                globs?: readonly string[] | undefined;
              };
            }[];
            fileLoads: readonly {
              type: "MainContextLoad";
              data: {
                id: string;
                kind: string;
                tokens: number;
                globs?: readonly string[] | undefined;
              };
            }[];
            totalTokens: number;
          };
        }[];
      };
    };
  };
};

/** Every DTO's type, under its name: what its schema infers. */
declare namespace RuntimeDTOs {
  type EvalCaseReport = z.infer<typeof RuntimeDTOs.EvalCaseReport>;
  type EvalLogAnalysis = z.infer<typeof RuntimeDTOs.EvalLogAnalysis>;
  type EvalRunReport = z.infer<typeof RuntimeDTOs.EvalRunReport>;
  type MainContext = z.infer<typeof RuntimeDTOs.MainContext>;
  type MainContextLoad = z.infer<typeof RuntimeDTOs.MainContextLoad>;
  type MainContexts = z.infer<typeof RuntimeDTOs.MainContexts>;
  type SensorRunOutcome = z.infer<typeof RuntimeDTOs.SensorRunOutcome>;
  type SessionReviewOutcome = z.infer<typeof RuntimeDTOs.SessionReviewOutcome>;
  type SessionSummary = z.infer<typeof RuntimeDTOs.SessionSummary>;
  type ToolAnswer = z.infer<typeof RuntimeDTOs.ToolAnswer>;
}

/**
 * DRIVER PORT — running what the charter built: the sensors of a signal, the
 * calls forwarded to the mcp origins, the evaluations against the real agent
 * and their log, the main context counted exactly, and the agents' sessions
 * kept on this machine (CORE-FR-222). What it needs of the charter it asks
 * charter's applications, in DTOs (CORE-FR-229).
 *
 * Every answer is a DTO, told apart from the others it may be by its `type`;
 * whatever stops an operation is among them, a `FaultDTOs.Fault`, and never
 * thrown (SDK-FR-004, SDK-FR-017, SDK-FR-018).
 */
interface ForRunningCharter {
  /** The sensors of one signal, run as one hook, each to its end whatever the
   *  others do (CORE-FR-176 – CORE-FR-179). */
  runSensors(
    signal: string,
    stdin: string,
    agent?: AgentProviderName,
  ): Promise<RuntimeDTOs.SensorRunOutcome | FaultDTOs.Fault>;
  /** One call forwarded to the mcp origin serving it, reached for this call
   *  alone and let go once it has answered (EVAL-FR-031, FR-154). */
  call(name: string, args: Readonly<Record<string, unknown>>): Promise<RuntimeDTOs.ToolAnswer | FaultDTOs.Fault>;
  /** What each agent the repository compiles for is sent of the charter when a
   *  session opens, counted exactly by its own command line (EVAL-FR-004). */
  countMainContext(): Promise<RuntimeDTOs.MainContexts | FaultDTOs.FaultsByFile | FaultDTOs.Fault>;
  /**
   * Select an explicitly requested configured agent, or the sole configured
   * agent. Several agents require a choice from the driver before execution.
   *
   * Every case kept beside the charter as last committed, each handed once to
   * promptfoo, which puts it to the agent, run headless in a worktree of the
   * last commit kept under the log with its charter built, and grades it; and
   * how each came out (EVAL-FR-020). promptfoo is installed first where it is
   * not on the machine yet, saying so (EVAL-FR-032). Every worktree is removed,
   * and the working tree is left as it was (EVAL-FR-021). A charter with an
   * error, an evaluation file that does not read, and a case naming what the
   * charter does not hold are given back as faults, with no case run
   * (EVAL-FR-026).
   */
  evaluate(agent?: string): Promise<RuntimeDTOs.EvalRunReport | FaultDTOs.FaultsByFile | FaultDTOs.Fault>;
  /** What promptfoo logged of an evaluation, the last one where no log is
   *  named, read back. */
  analyze(logFilePath?: string): Promise<RuntimeDTOs.EvalLogAnalysis | FaultDTOs.Fault>;
  /**
   * The sessions kept, summed up by day and by session, in tokens, over the
   * days from `since` to `until`, both counted in and each `YYYY-MM-DD`: the
   * last 31 days where neither is given (EVAL-FR-030). No session kept is an
   * answer rather than a failure.
   */
  sessionSummary(since?: string, until?: string): Promise<RuntimeDTOs.SessionReviewOutcome | FaultDTOs.Fault>;
}

/** What an adapter answering this port raises when git refuses, named again
 *  here so it names this port and nothing behind it. */

/**
 * DRIVEN PORT — worktrees of a repository's last commit, the one thing
 * evaluating asks of version control, apart from what fetching a source asks
 * (CORE-FR-206).
 */
interface ForKeepingWorktrees {
  /**
   * A worktree of this repository's last commit, checked out detached at this
   * path from the repository: its files as committed, and none of the work in hand
   * (EVAL-FR-021). A repository with nothing committed, and a folder under no
   * repository, each raise an `AdapterFault` in git's words.
   */
  addWorktree(worktreePath: string): Promise<void>;
  /** One worktree taken away: its folder, and version control's record of
   *  it. A folder that is no worktree any more, or is not there, is removed
   *  all the same. */
  removeWorktree(worktreePath: string): Promise<void>;
}

/** What an adapter answering this port raises when the command line refuses,
 *  named again here so it names this port and nothing behind it. */

/**
 * DRIVEN PORT — an agent's own command line, run headless: one prompt asked,
 * and the model's answer to it out. One adapter per agent's command line;
 * the composition root hands each under the agent it runs (EVAL-FR-004).
 *
 * The prompt is run in a folder of its own holding nothing, so what the model
 * was sent is the command line's own and the prompt, and nothing of whichever
 * repository asked.
 */
interface ForCheckingAgentCli {
  /** Is the command line installed on this machine? */
  isInstalled(): Promise<boolean>;
}

interface ForRunningAgentCli extends ForCheckingAgentCli {
  /** This prompt asked, and what the model answered: what it said, and the
   *  usage the command line reports of what it was sent. */
  ask(prompt: string): Promise<Answer>;
}

/** What an adapter answering this port raises when promptfoo cannot be
 *  installed or stops with an error, named again here so it names this port and
 *  nothing behind it. */

/**
 * DRIVEN PORT — promptfoo, the evaluation framework a charter is evaluated
 * under (EVAL-FR-020, EVAL-FR-032): installed once onto this machine, then
 * handed one test at a time, which it runs against the selected agent in the folder
 * named and grades by the assertions it carries.
 */
interface ForRunningPromptfoo {
  /** Is promptfoo, and what it needs to run the supported agents, on this machine? */
  isInstalled(): Promise<boolean>;
  /** Install it once into a folder of its own, outside every repository. */
  install(): Promise<void>;
  /** Where it is installed, as the developer would find it. */
  readonly installFolderPath: string;
  /** One test run with `promptfoo eval`: its prompt put to the selected agent,
   *  headless, in the working folder, with the project's settings and skills
   *  and edits accepted, on whatever it is signed in with; and how it came
   *  out. A run promptfoo itself fails raises an `AdapterFault`. */
  evaluate(promptfooTest: PromptfooTest): Promise<PromptfooTestResult>;
  /** Read saved promptfoo artifacts without invoking an agent. With no path,
   * list the latest twenty case logs belonging to this repository. */
  readLogs(logFilePath?: string): Promise<readonly PromptfooLog[]>;
}

/**
 * DRIVEN PORT — the shell of this machine: one command line run in a folder,
 * handed text on its standard input, and what it exited with and wrote.
 *
 * A command that fails is answered as its exit code and what it wrote, never
 * raised: whether that is wrong is the caller's to say.
 */
interface ForRunningShellCommands {
  /** Run `command` in the folder at `workingPath` from the repository through the shell, `stdin` written to it,
   *  and answer once it has exited. */
  runShellCommand(command: string, workingPath: string, stdin: string): Promise<ShellCommandResult>;
}

/** One prompt answered, as the command line reports it. */
interface Answer {
  readonly resultText: string;
  readonly usage: PromptUsage;
}

/** The input side of one run's usage, as the command line reports it: tokens
 *  sent fresh, written to the cache, and read from it. */
interface PromptUsage {
  readonly inputTokens: number;
  readonly cacheCreationInputTokens: number;
  readonly cacheReadInputTokens: number;
}

/** One promptfoo test, in promptfoo's own words. */
interface PromptfooTest {
  readonly agent: string;
  readonly description: string;
  readonly prompt: string;
  /** The folder the selected agent runs in, by its path from the repository. */
  readonly workingPath: string;
  readonly assertions: readonly PromptfooAssertion[];
}

/** One promptfoo assertion: a skill the agent invoked, a rubric an agent
 *  grader holds what the agent did to, reading the working folder itself, or
 *  a JavaScript check of the response. */
interface PromptfooAssertion {
  readonly type: "skill-used" | "agent-rubric" | "javascript" | "file-read";
  readonly value: string;
}

/** How one test came out, as promptfoo writes it: whether it passed, the
 *  tokens the provider reported in all, each assertion's grading, and the
 *  error where the provider could not run. */
interface PromptfooTestResult {
  readonly success: boolean;
  readonly totalTokens: number;
  readonly componentResults: readonly {
    readonly assertionType: string;
    readonly pass: boolean;
    readonly reason: string;
  }[];
  readonly error?: string;
  readonly logPath?: string;
  readonly sessionId?: string;
  readonly sessionPath?: string;
}

/** A saved case and its diagnostics, read without an inference call. */
interface PromptfooLog {
  readonly logPath: string;
  readonly createdAt: string;
  readonly agent: string;
  readonly prompt: string;
  readonly workingFolderPath: string;
  readonly outputPath: string;
  readonly stdoutPath: string;
  readonly stderrPath: string;
  readonly success: boolean;
  readonly totalTokens: number;
  readonly unmetReasons: readonly string[];
  readonly answer: string;
  readonly toolCalls: readonly string[];
  readonly sessionId?: string;
  readonly sessionPath?: string;
  readonly error?: string;
}

/** What one command line came to. */
interface ShellCommandResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

/**
 * What every agent's own command line is to the engine: one it can ask
 * whether it is installed. An agent that runs evaluations headless answers
 * prompts as well (`ForRunningAgentCli`); what it runs and how is the agent's
 * own.
 */
declare abstract class AgentCli implements ForCheckingAgentCli {
  abstract isInstalled(): Promise<boolean>;
}

/**
 * DRIVEN ADAPTER: Claude Code's own command line, `claude -p`, run headless.
 *
 * Each prompt is run in an empty folder of its own, with nothing loaded, so
 * the model is sent Claude Code's own instructions and the prompt, and the
 * same instructions on every run. A count is read off the JSON it prints, of
 * the first message sent: a model answering at length can run on into a
 * second, whose input the total adds again. It runs on whatever `claude` is
 * signed in with: no key of this engine's (EVAL-FR-004). At most
 * `PARALLEL_RUNNER_COUNT` run together.
 */
declare class ClaudeCli extends AgentCli implements ForRunningAgentCli {
  #private;
  isInstalled(): Promise<boolean>;
  ask(prompt: string): Promise<Answer>;
}

/** Check the Codex CLI used by promptfoo without asking a model. */
declare class CodexCli extends AgentCli {
  isInstalled(): Promise<boolean>;
}
