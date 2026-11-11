// The library's declarations from charter, split from dist/index.d.ts for reading.

/** Every schema of this module's DTOs, under its name — the name it carries
 *  as `type` — in alphabetical order. */
declare const CharterDTOs: {
  PrimitiveKinds: z.ZodObject<
    {
      type: z.ZodLiteral<"PrimitiveKinds">;
      data: z.ZodRecord<z.ZodString, z.ZodString>;
    },
    z.core.$strip
  > & {
    of: (dataValue: Record<string, string>) => {
      type: "PrimitiveKinds";
      data: Record<string, string>;
    };
  };
  CatalogueEntry: z.ZodObject<
    {
      type: z.ZodLiteral<"CatalogueEntry">;
      data: z.ZodObject<
        {
          agentProviders: z.ZodUnion<readonly [z.ZodLiteral<"all">, z.ZodReadonly<z.ZodArray<z.ZodString>>]>;
          id: z.ZodString;
          kind: z.ZodString;
          description: z.ZodString;
          file: z.ZodString;
          globs: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
        },
        z.core.$strip
      >;
    },
    z.core.$strip
  > & {
    of: (dataValue: {
      agentProviders: readonly string[] | "all";
      id: string;
      kind: string;
      description: string;
      file: string;
      globs?: readonly string[] | undefined;
    }) => {
      type: "CatalogueEntry";
      data: {
        agentProviders: readonly string[] | "all";
        id: string;
        kind: string;
        description: string;
        file: string;
        globs?: readonly string[] | undefined;
      };
    };
  };
  Catalogue: z.ZodObject<
    {
      type: z.ZodLiteral<"Catalogue">;
      data: z.ZodObject<
        {
          entries: z.ZodReadonly<
            z.ZodArray<
              z.ZodObject<
                {
                  type: z.ZodLiteral<"CatalogueEntry">;
                  data: z.ZodObject<
                    {
                      agentProviders: z.ZodUnion<
                        readonly [z.ZodLiteral<"all">, z.ZodReadonly<z.ZodArray<z.ZodString>>]
                      >;
                      id: z.ZodString;
                      kind: z.ZodString;
                      description: z.ZodString;
                      file: z.ZodString;
                      globs: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
                    },
                    z.core.$strip
                  >;
                },
                z.core.$strip
              > & {
                of: (dataValue: {
                  agentProviders: readonly string[] | "all";
                  id: string;
                  kind: string;
                  description: string;
                  file: string;
                  globs?: readonly string[] | undefined;
                }) => {
                  type: "CatalogueEntry";
                  data: {
                    agentProviders: readonly string[] | "all";
                    id: string;
                    kind: string;
                    description: string;
                    file: string;
                    globs?: readonly string[] | undefined;
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
      entries: readonly {
        type: "CatalogueEntry";
        data: {
          agentProviders: readonly string[] | "all";
          id: string;
          kind: string;
          description: string;
          file: string;
          globs?: readonly string[] | undefined;
        };
      }[];
    }) => {
      type: "Catalogue";
      data: {
        entries: readonly {
          type: "CatalogueEntry";
          data: {
            agentProviders: readonly string[] | "all";
            id: string;
            kind: string;
            description: string;
            file: string;
            globs?: readonly string[] | undefined;
          };
        }[];
      };
    };
  };
  Primitive: z.ZodObject<
    {
      type: z.ZodLiteral<"Primitive">;
      data: z.ZodObject<
        {
          id: z.ZodString;
          kind: z.ZodString;
          description: z.ZodString;
          file: z.ZodString;
          layerName: z.ZodEnum<{
            repo: "repo";
            vendor: "vendor";
            builtin: "builtin";
          }>;
          headers: z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodReadonly<z.ZodArray<z.ZodString>>]>>;
          body: z.ZodString;
          hash: z.ZodString;
        },
        z.core.$strip
      >;
    },
    z.core.$strip
  > & {
    of: (dataValue: {
      id: string;
      kind: string;
      description: string;
      file: string;
      layerName: "repo" | "vendor" | "builtin";
      headers: Record<string, string | readonly string[]>;
      body: string;
      hash: string;
    }) => {
      type: "Primitive";
      data: {
        id: string;
        kind: string;
        description: string;
        file: string;
        layerName: "repo" | "vendor" | "builtin";
        headers: Record<string, string | readonly string[]>;
        body: string;
        hash: string;
      };
    };
  };
  Primitives: z.ZodObject<
    {
      type: z.ZodLiteral<"Primitives">;
      data: z.ZodObject<
        {
          primitives: z.ZodReadonly<
            z.ZodArray<
              z.ZodObject<
                {
                  type: z.ZodLiteral<"Primitive">;
                  data: z.ZodObject<
                    {
                      id: z.ZodString;
                      kind: z.ZodString;
                      description: z.ZodString;
                      file: z.ZodString;
                      layerName: z.ZodEnum<{
                        repo: "repo";
                        vendor: "vendor";
                        builtin: "builtin";
                      }>;
                      headers: z.ZodRecord<
                        z.ZodString,
                        z.ZodUnion<readonly [z.ZodString, z.ZodReadonly<z.ZodArray<z.ZodString>>]>
                      >;
                      body: z.ZodString;
                      hash: z.ZodString;
                    },
                    z.core.$strip
                  >;
                },
                z.core.$strip
              > & {
                of: (dataValue: {
                  id: string;
                  kind: string;
                  description: string;
                  file: string;
                  layerName: "repo" | "vendor" | "builtin";
                  headers: Record<string, string | readonly string[]>;
                  body: string;
                  hash: string;
                }) => {
                  type: "Primitive";
                  data: {
                    id: string;
                    kind: string;
                    description: string;
                    file: string;
                    layerName: "repo" | "vendor" | "builtin";
                    headers: Record<string, string | readonly string[]>;
                    body: string;
                    hash: string;
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
      primitives: readonly {
        type: "Primitive";
        data: {
          id: string;
          kind: string;
          description: string;
          file: string;
          layerName: "repo" | "vendor" | "builtin";
          headers: Record<string, string | readonly string[]>;
          body: string;
          hash: string;
        };
      }[];
    }) => {
      type: "Primitives";
      data: {
        primitives: readonly {
          type: "Primitive";
          data: {
            id: string;
            kind: string;
            description: string;
            file: string;
            layerName: "repo" | "vendor" | "builtin";
            headers: Record<string, string | readonly string[]>;
            body: string;
            hash: string;
          };
        }[];
      };
    };
  };
  PlanSummary: z.ZodObject<
    {
      type: z.ZodLiteral<"PlanSummary">;
      data: z.ZodObject<
        {
          added: z.ZodReadonly<z.ZodArray<z.ZodString>>;
          edited: z.ZodReadonly<z.ZodArray<z.ZodString>>;
          deleted: z.ZodReadonly<z.ZodArray<z.ZodString>>;
          unchanged: z.ZodReadonly<z.ZodArray<z.ZodString>>;
          warnings: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
        },
        z.core.$strip
      >;
    },
    z.core.$strip
  > & {
    of: (dataValue: {
      added: readonly string[];
      edited: readonly string[];
      deleted: readonly string[];
      unchanged: readonly string[];
      warnings?: readonly string[] | undefined;
    }) => {
      type: "PlanSummary";
      data: {
        added: readonly string[];
        edited: readonly string[];
        deleted: readonly string[];
        unchanged: readonly string[];
        warnings?: readonly string[] | undefined;
      };
    };
  };
  PrimitiveHeader: z.ZodObject<
    {
      type: z.ZodLiteral<"PrimitiveHeader">;
      data: z.ZodObject<
        {
          field: z.ZodString;
          shape: z.ZodEnum<{
            line: "line";
            list: "list";
          }>;
          required: z.ZodBoolean;
          allowedValues: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
        },
        z.core.$strip
      >;
    },
    z.core.$strip
  > & {
    of: (dataValue: {
      field: string;
      shape: "line" | "list";
      required: boolean;
      allowedValues?: readonly string[] | undefined;
    }) => {
      type: "PrimitiveHeader";
      data: {
        field: string;
        shape: "line" | "list";
        required: boolean;
        allowedValues?: readonly string[] | undefined;
      };
    };
  };
  PrimitiveRequirements: z.ZodObject<
    {
      type: z.ZodLiteral<"PrimitiveRequirements">;
      data: z.ZodObject<
        {
          headers: z.ZodReadonly<
            z.ZodArray<
              z.ZodObject<
                {
                  type: z.ZodLiteral<"PrimitiveHeader">;
                  data: z.ZodObject<
                    {
                      field: z.ZodString;
                      shape: z.ZodEnum<{
                        line: "line";
                        list: "list";
                      }>;
                      required: z.ZodBoolean;
                      allowedValues: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
                    },
                    z.core.$strip
                  >;
                },
                z.core.$strip
              > & {
                of: (dataValue: {
                  field: string;
                  shape: "line" | "list";
                  required: boolean;
                  allowedValues?: readonly string[] | undefined;
                }) => {
                  type: "PrimitiveHeader";
                  data: {
                    field: string;
                    shape: "line" | "list";
                    required: boolean;
                    allowedValues?: readonly string[] | undefined;
                  };
                };
              }
            >
          >;
          sample: z.ZodString;
        },
        z.core.$strip
      >;
    },
    z.core.$strip
  > & {
    of: (dataValue: {
      headers: readonly {
        type: "PrimitiveHeader";
        data: {
          field: string;
          shape: "line" | "list";
          required: boolean;
          allowedValues?: readonly string[] | undefined;
        };
      }[];
      sample: string;
    }) => {
      type: "PrimitiveRequirements";
      data: {
        headers: readonly {
          type: "PrimitiveHeader";
          data: {
            field: string;
            shape: "line" | "list";
            required: boolean;
            allowedValues?: readonly string[] | undefined;
          };
        }[];
        sample: string;
      };
    };
  };
  TestCasesByFile: z.ZodObject<
    {
      type: z.ZodLiteral<"TestCasesByFile">;
      data: z.ZodRecord<z.ZodString, z.ZodReadonly<z.ZodArray<z.ZodString>>>;
    },
    z.core.$strip
  > & {
    of: (dataValue: Record<string, readonly string[]>) => {
      type: "TestCasesByFile";
      data: Record<string, readonly string[]>;
    };
  };
  TestCaseReport: z.ZodObject<
    {
      type: z.ZodLiteral<"TestCaseReport">;
      data: z.ZodObject<
        {
          suiteName: z.ZodString;
          situation: z.ZodString;
          passed: z.ZodBoolean;
          unmet: z.ZodOptional<
            z.ZodObject<
              {
                type: z.ZodLiteral<"Fault">;
                data: z.ZodObject<
                  {
                    name: z.ZodString;
                    message: z.ZodString;
                    fix: z.ZodString;
                    severity: z.ZodEnum<{
                      error: "error";
                      warn: "warn";
                    }>;
                  },
                  z.core.$strip
                >;
              },
              z.core.$strip
            > & {
              of: (dataValue: { name: string; message: string; fix: string; severity: "error" | "warn" }) => {
                type: "Fault";
                data: {
                  name: string;
                  message: string;
                  fix: string;
                  severity: "error" | "warn";
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
      suiteName: string;
      situation: string;
      passed: boolean;
      unmet?:
        | {
            type: "Fault";
            data: {
              name: string;
              message: string;
              fix: string;
              severity: "error" | "warn";
            };
          }
        | undefined;
    }) => {
      type: "TestCaseReport";
      data: {
        suiteName: string;
        situation: string;
        passed: boolean;
        unmet?:
          | {
              type: "Fault";
              data: {
                name: string;
                message: string;
                fix: string;
                severity: "error" | "warn";
              };
            }
          | undefined;
      };
    };
  };
  TestRunReport: z.ZodObject<
    {
      type: z.ZodLiteral<"TestRunReport">;
      data: z.ZodObject<
        {
          testCaseReports: z.ZodReadonly<
            z.ZodArray<
              z.ZodObject<
                {
                  type: z.ZodLiteral<"TestCaseReport">;
                  data: z.ZodObject<
                    {
                      suiteName: z.ZodString;
                      situation: z.ZodString;
                      passed: z.ZodBoolean;
                      unmet: z.ZodOptional<
                        z.ZodObject<
                          {
                            type: z.ZodLiteral<"Fault">;
                            data: z.ZodObject<
                              {
                                name: z.ZodString;
                                message: z.ZodString;
                                fix: z.ZodString;
                                severity: z.ZodEnum<{
                                  error: "error";
                                  warn: "warn";
                                }>;
                              },
                              z.core.$strip
                            >;
                          },
                          z.core.$strip
                        > & {
                          of: (dataValue: {
                            name: string;
                            message: string;
                            fix: string;
                            severity: "error" | "warn";
                          }) => {
                            type: "Fault";
                            data: {
                              name: string;
                              message: string;
                              fix: string;
                              severity: "error" | "warn";
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
                  suiteName: string;
                  situation: string;
                  passed: boolean;
                  unmet?:
                    | {
                        type: "Fault";
                        data: {
                          name: string;
                          message: string;
                          fix: string;
                          severity: "error" | "warn";
                        };
                      }
                    | undefined;
                }) => {
                  type: "TestCaseReport";
                  data: {
                    suiteName: string;
                    situation: string;
                    passed: boolean;
                    unmet?:
                      | {
                          type: "Fault";
                          data: {
                            name: string;
                            message: string;
                            fix: string;
                            severity: "error" | "warn";
                          };
                        }
                      | undefined;
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
      testCaseReports: readonly {
        type: "TestCaseReport";
        data: {
          suiteName: string;
          situation: string;
          passed: boolean;
          unmet?:
            | {
                type: "Fault";
                data: {
                  name: string;
                  message: string;
                  fix: string;
                  severity: "error" | "warn";
                };
              }
            | undefined;
        };
      }[];
    }) => {
      type: "TestRunReport";
      data: {
        testCaseReports: readonly {
          type: "TestCaseReport";
          data: {
            suiteName: string;
            situation: string;
            passed: boolean;
            unmet?:
              | {
                  type: "Fault";
                  data: {
                    name: string;
                    message: string;
                    fix: string;
                    severity: "error" | "warn";
                  };
                }
              | undefined;
          };
        }[];
      };
    };
  };
  TestCase: z.ZodObject<
    {
      type: z.ZodLiteral<"TestCase">;
      data: z.ZodObject<
        {
          situation: z.ZodString;
          expectation: z.ZodString;
          id: z.ZodOptional<z.ZodString>;
        },
        z.core.$strip
      >;
    },
    z.core.$strip
  > & {
    of: (dataValue: { situation: string; expectation: string; id?: string | undefined }) => {
      type: "TestCase";
      data: {
        situation: string;
        expectation: string;
        id?: string | undefined;
      };
    };
  };
  TestSuite: z.ZodObject<
    {
      type: z.ZodLiteral<"TestSuite">;
      data: z.ZodObject<
        {
          name: z.ZodString;
          text: z.ZodOptional<z.ZodString>;
          description: z.ZodOptional<z.ZodString>;
          cases: z.ZodReadonly<
            z.ZodArray<
              z.ZodObject<
                {
                  type: z.ZodLiteral<"TestCase">;
                  data: z.ZodObject<
                    {
                      situation: z.ZodString;
                      expectation: z.ZodString;
                      id: z.ZodOptional<z.ZodString>;
                    },
                    z.core.$strip
                  >;
                },
                z.core.$strip
              > & {
                of: (dataValue: { situation: string; expectation: string; id?: string | undefined }) => {
                  type: "TestCase";
                  data: {
                    situation: string;
                    expectation: string;
                    id?: string | undefined;
                  };
                };
              }
            >
          >;
          fault: z.ZodOptional<
            z.ZodObject<
              {
                type: z.ZodLiteral<"Fault">;
                data: z.ZodObject<
                  {
                    name: z.ZodString;
                    message: z.ZodString;
                    fix: z.ZodString;
                    severity: z.ZodEnum<{
                      error: "error";
                      warn: "warn";
                    }>;
                  },
                  z.core.$strip
                >;
              },
              z.core.$strip
            > & {
              of: (dataValue: { name: string; message: string; fix: string; severity: "error" | "warn" }) => {
                type: "Fault";
                data: {
                  name: string;
                  message: string;
                  fix: string;
                  severity: "error" | "warn";
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
      name: string;
      cases: readonly {
        type: "TestCase";
        data: {
          situation: string;
          expectation: string;
          id?: string | undefined;
        };
      }[];
      text?: string | undefined;
      description?: string | undefined;
      fault?:
        | {
            type: "Fault";
            data: {
              name: string;
              message: string;
              fix: string;
              severity: "error" | "warn";
            };
          }
        | undefined;
    }) => {
      type: "TestSuite";
      data: {
        name: string;
        cases: readonly {
          type: "TestCase";
          data: {
            situation: string;
            expectation: string;
            id?: string | undefined;
          };
        }[];
        text?: string | undefined;
        description?: string | undefined;
        fault?:
          | {
              type: "Fault";
              data: {
                name: string;
                message: string;
                fix: string;
                severity: "error" | "warn";
              };
            }
          | undefined;
      };
    };
  };
  TestSuites: z.ZodObject<
    {
      type: z.ZodLiteral<"TestSuites">;
      data: z.ZodObject<
        {
          testSuites: z.ZodReadonly<
            z.ZodArray<
              z.ZodObject<
                {
                  type: z.ZodLiteral<"TestSuite">;
                  data: z.ZodObject<
                    {
                      name: z.ZodString;
                      text: z.ZodOptional<z.ZodString>;
                      description: z.ZodOptional<z.ZodString>;
                      cases: z.ZodReadonly<
                        z.ZodArray<
                          z.ZodObject<
                            {
                              type: z.ZodLiteral<"TestCase">;
                              data: z.ZodObject<
                                {
                                  situation: z.ZodString;
                                  expectation: z.ZodString;
                                  id: z.ZodOptional<z.ZodString>;
                                },
                                z.core.$strip
                              >;
                            },
                            z.core.$strip
                          > & {
                            of: (dataValue: { situation: string; expectation: string; id?: string | undefined }) => {
                              type: "TestCase";
                              data: {
                                situation: string;
                                expectation: string;
                                id?: string | undefined;
                              };
                            };
                          }
                        >
                      >;
                      fault: z.ZodOptional<
                        z.ZodObject<
                          {
                            type: z.ZodLiteral<"Fault">;
                            data: z.ZodObject<
                              {
                                name: z.ZodString;
                                message: z.ZodString;
                                fix: z.ZodString;
                                severity: z.ZodEnum<{
                                  error: "error";
                                  warn: "warn";
                                }>;
                              },
                              z.core.$strip
                            >;
                          },
                          z.core.$strip
                        > & {
                          of: (dataValue: {
                            name: string;
                            message: string;
                            fix: string;
                            severity: "error" | "warn";
                          }) => {
                            type: "Fault";
                            data: {
                              name: string;
                              message: string;
                              fix: string;
                              severity: "error" | "warn";
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
                  name: string;
                  cases: readonly {
                    type: "TestCase";
                    data: {
                      situation: string;
                      expectation: string;
                      id?: string | undefined;
                    };
                  }[];
                  text?: string | undefined;
                  description?: string | undefined;
                  fault?:
                    | {
                        type: "Fault";
                        data: {
                          name: string;
                          message: string;
                          fix: string;
                          severity: "error" | "warn";
                        };
                      }
                    | undefined;
                }) => {
                  type: "TestSuite";
                  data: {
                    name: string;
                    cases: readonly {
                      type: "TestCase";
                      data: {
                        situation: string;
                        expectation: string;
                        id?: string | undefined;
                      };
                    }[];
                    text?: string | undefined;
                    description?: string | undefined;
                    fault?:
                      | {
                          type: "Fault";
                          data: {
                            name: string;
                            message: string;
                            fix: string;
                            severity: "error" | "warn";
                          };
                        }
                      | undefined;
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
      testSuites: readonly {
        type: "TestSuite";
        data: {
          name: string;
          cases: readonly {
            type: "TestCase";
            data: {
              situation: string;
              expectation: string;
              id?: string | undefined;
            };
          }[];
          text?: string | undefined;
          description?: string | undefined;
          fault?:
            | {
                type: "Fault";
                data: {
                  name: string;
                  message: string;
                  fix: string;
                  severity: "error" | "warn";
                };
              }
            | undefined;
        };
      }[];
    }) => {
      type: "TestSuites";
      data: {
        testSuites: readonly {
          type: "TestSuite";
          data: {
            name: string;
            cases: readonly {
              type: "TestCase";
              data: {
                situation: string;
                expectation: string;
                id?: string | undefined;
              };
            }[];
            text?: string | undefined;
            description?: string | undefined;
            fault?:
              | {
                  type: "Fault";
                  data: {
                    name: string;
                    message: string;
                    fix: string;
                    severity: "error" | "warn";
                  };
                }
              | undefined;
          };
        }[];
      };
    };
  };
  TestSuiteName: z.ZodObject<
    {
      type: z.ZodLiteral<"TestSuiteName">;
      data: z.ZodObject<
        {
          name: z.ZodString;
        },
        z.core.$strip
      >;
    },
    z.core.$strip
  > & {
    of: (dataValue: { name: string }) => {
      type: "TestSuiteName";
      data: {
        name: string;
      };
    };
  };
  EvalCase: z.ZodObject<
    {
      type: z.ZodLiteral<"EvalCase">;
      data: z.ZodObject<
        {
          prompt: z.ZodString;
          invoke: z.ZodOptional<z.ZodString>;
          follow: z.ZodOptional<z.ZodString>;
          read: z.ZodOptional<z.ZodString>;
          maxTokens: z.ZodOptional<z.ZodNumber>;
        },
        z.core.$strip
      >;
    },
    z.core.$strip
  > & {
    of: (dataValue: {
      prompt: string;
      invoke?: string | undefined;
      follow?: string | undefined;
      read?: string | undefined;
      maxTokens?: number | undefined;
    }) => {
      type: "EvalCase";
      data: {
        prompt: string;
        invoke?: string | undefined;
        follow?: string | undefined;
        read?: string | undefined;
        maxTokens?: number | undefined;
      };
    };
  };
  EvalSuite: z.ZodObject<
    {
      type: z.ZodLiteral<"EvalSuite">;
      data: z.ZodObject<
        {
          name: z.ZodString;
          text: z.ZodOptional<z.ZodString>;
          description: z.ZodOptional<z.ZodString>;
          cases: z.ZodReadonly<
            z.ZodArray<
              z.ZodObject<
                {
                  type: z.ZodLiteral<"EvalCase">;
                  data: z.ZodObject<
                    {
                      prompt: z.ZodString;
                      invoke: z.ZodOptional<z.ZodString>;
                      follow: z.ZodOptional<z.ZodString>;
                      read: z.ZodOptional<z.ZodString>;
                      maxTokens: z.ZodOptional<z.ZodNumber>;
                    },
                    z.core.$strip
                  >;
                },
                z.core.$strip
              > & {
                of: (dataValue: {
                  prompt: string;
                  invoke?: string | undefined;
                  follow?: string | undefined;
                  read?: string | undefined;
                  maxTokens?: number | undefined;
                }) => {
                  type: "EvalCase";
                  data: {
                    prompt: string;
                    invoke?: string | undefined;
                    follow?: string | undefined;
                    read?: string | undefined;
                    maxTokens?: number | undefined;
                  };
                };
              }
            >
          >;
          fault: z.ZodOptional<
            z.ZodObject<
              {
                type: z.ZodLiteral<"Fault">;
                data: z.ZodObject<
                  {
                    name: z.ZodString;
                    message: z.ZodString;
                    fix: z.ZodString;
                    severity: z.ZodEnum<{
                      error: "error";
                      warn: "warn";
                    }>;
                  },
                  z.core.$strip
                >;
              },
              z.core.$strip
            > & {
              of: (dataValue: { name: string; message: string; fix: string; severity: "error" | "warn" }) => {
                type: "Fault";
                data: {
                  name: string;
                  message: string;
                  fix: string;
                  severity: "error" | "warn";
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
      name: string;
      cases: readonly {
        type: "EvalCase";
        data: {
          prompt: string;
          invoke?: string | undefined;
          follow?: string | undefined;
          read?: string | undefined;
          maxTokens?: number | undefined;
        };
      }[];
      text?: string | undefined;
      description?: string | undefined;
      fault?:
        | {
            type: "Fault";
            data: {
              name: string;
              message: string;
              fix: string;
              severity: "error" | "warn";
            };
          }
        | undefined;
    }) => {
      type: "EvalSuite";
      data: {
        name: string;
        cases: readonly {
          type: "EvalCase";
          data: {
            prompt: string;
            invoke?: string | undefined;
            follow?: string | undefined;
            read?: string | undefined;
            maxTokens?: number | undefined;
          };
        }[];
        text?: string | undefined;
        description?: string | undefined;
        fault?:
          | {
              type: "Fault";
              data: {
                name: string;
                message: string;
                fix: string;
                severity: "error" | "warn";
              };
            }
          | undefined;
      };
    };
  };
  EvalSuites: z.ZodObject<
    {
      type: z.ZodLiteral<"EvalSuites">;
      data: z.ZodObject<
        {
          evalSuites: z.ZodReadonly<
            z.ZodArray<
              z.ZodObject<
                {
                  type: z.ZodLiteral<"EvalSuite">;
                  data: z.ZodObject<
                    {
                      name: z.ZodString;
                      text: z.ZodOptional<z.ZodString>;
                      description: z.ZodOptional<z.ZodString>;
                      cases: z.ZodReadonly<
                        z.ZodArray<
                          z.ZodObject<
                            {
                              type: z.ZodLiteral<"EvalCase">;
                              data: z.ZodObject<
                                {
                                  prompt: z.ZodString;
                                  invoke: z.ZodOptional<z.ZodString>;
                                  follow: z.ZodOptional<z.ZodString>;
                                  read: z.ZodOptional<z.ZodString>;
                                  maxTokens: z.ZodOptional<z.ZodNumber>;
                                },
                                z.core.$strip
                              >;
                            },
                            z.core.$strip
                          > & {
                            of: (dataValue: {
                              prompt: string;
                              invoke?: string | undefined;
                              follow?: string | undefined;
                              read?: string | undefined;
                              maxTokens?: number | undefined;
                            }) => {
                              type: "EvalCase";
                              data: {
                                prompt: string;
                                invoke?: string | undefined;
                                follow?: string | undefined;
                                read?: string | undefined;
                                maxTokens?: number | undefined;
                              };
                            };
                          }
                        >
                      >;
                      fault: z.ZodOptional<
                        z.ZodObject<
                          {
                            type: z.ZodLiteral<"Fault">;
                            data: z.ZodObject<
                              {
                                name: z.ZodString;
                                message: z.ZodString;
                                fix: z.ZodString;
                                severity: z.ZodEnum<{
                                  error: "error";
                                  warn: "warn";
                                }>;
                              },
                              z.core.$strip
                            >;
                          },
                          z.core.$strip
                        > & {
                          of: (dataValue: {
                            name: string;
                            message: string;
                            fix: string;
                            severity: "error" | "warn";
                          }) => {
                            type: "Fault";
                            data: {
                              name: string;
                              message: string;
                              fix: string;
                              severity: "error" | "warn";
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
                  name: string;
                  cases: readonly {
                    type: "EvalCase";
                    data: {
                      prompt: string;
                      invoke?: string | undefined;
                      follow?: string | undefined;
                      read?: string | undefined;
                      maxTokens?: number | undefined;
                    };
                  }[];
                  text?: string | undefined;
                  description?: string | undefined;
                  fault?:
                    | {
                        type: "Fault";
                        data: {
                          name: string;
                          message: string;
                          fix: string;
                          severity: "error" | "warn";
                        };
                      }
                    | undefined;
                }) => {
                  type: "EvalSuite";
                  data: {
                    name: string;
                    cases: readonly {
                      type: "EvalCase";
                      data: {
                        prompt: string;
                        invoke?: string | undefined;
                        follow?: string | undefined;
                        read?: string | undefined;
                        maxTokens?: number | undefined;
                      };
                    }[];
                    text?: string | undefined;
                    description?: string | undefined;
                    fault?:
                      | {
                          type: "Fault";
                          data: {
                            name: string;
                            message: string;
                            fix: string;
                            severity: "error" | "warn";
                          };
                        }
                      | undefined;
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
      evalSuites: readonly {
        type: "EvalSuite";
        data: {
          name: string;
          cases: readonly {
            type: "EvalCase";
            data: {
              prompt: string;
              invoke?: string | undefined;
              follow?: string | undefined;
              read?: string | undefined;
              maxTokens?: number | undefined;
            };
          }[];
          text?: string | undefined;
          description?: string | undefined;
          fault?:
            | {
                type: "Fault";
                data: {
                  name: string;
                  message: string;
                  fix: string;
                  severity: "error" | "warn";
                };
              }
            | undefined;
        };
      }[];
    }) => {
      type: "EvalSuites";
      data: {
        evalSuites: readonly {
          type: "EvalSuite";
          data: {
            name: string;
            cases: readonly {
              type: "EvalCase";
              data: {
                prompt: string;
                invoke?: string | undefined;
                follow?: string | undefined;
                read?: string | undefined;
                maxTokens?: number | undefined;
              };
            }[];
            text?: string | undefined;
            description?: string | undefined;
            fault?:
              | {
                  type: "Fault";
                  data: {
                    name: string;
                    message: string;
                    fix: string;
                    severity: "error" | "warn";
                  };
                }
              | undefined;
          };
        }[];
      };
    };
  };
  EvalSuiteName: z.ZodObject<
    {
      type: z.ZodLiteral<"EvalSuiteName">;
      data: z.ZodObject<
        {
          name: z.ZodString;
        },
        z.core.$strip
      >;
    },
    z.core.$strip
  > & {
    of: (dataValue: { name: string }) => {
      type: "EvalSuiteName";
      data: {
        name: string;
      };
    };
  };
  VendorFolder: z.ZodObject<
    {
      type: z.ZodLiteral<"VendorFolder">;
      data: z.ZodObject<
        {
          folder: z.ZodString;
        },
        z.core.$strip
      >;
    },
    z.core.$strip
  > & {
    of: (dataValue: { folder: string }) => {
      type: "VendorFolder";
      data: {
        folder: string;
      };
    };
  };
  VendorFolders: z.ZodObject<
    {
      type: z.ZodLiteral<"VendorFolders">;
      data: z.ZodObject<
        {
          folders: z.ZodReadonly<z.ZodArray<z.ZodString>>;
        },
        z.core.$strip
      >;
    },
    z.core.$strip
  > & {
    of: (dataValue: { folders: readonly string[] }) => {
      type: "VendorFolders";
      data: {
        folders: readonly string[];
      };
    };
  };
  SignInStatus: z.ZodObject<
    {
      type: z.ZodLiteral<"SignInStatus">;
      data: z.ZodObject<
        {
          address: z.ZodString;
          ids: z.ZodReadonly<z.ZodArray<z.ZodString>>;
          auth: z.ZodReadonly<
            z.ZodArray<
              z.ZodEnum<{
                oauth: "oauth";
                token: "token";
              }>
            >
          >;
          signedIn: z.ZodBoolean;
          method: z.ZodOptional<
            z.ZodEnum<{
              oauth: "oauth";
              token: "token";
            }>
          >;
        },
        z.core.$strip
      >;
    },
    z.core.$strip
  > & {
    of: (dataValue: {
      address: string;
      ids: readonly string[];
      auth: readonly ("oauth" | "token")[];
      signedIn: boolean;
      method?: "oauth" | "token" | undefined;
    }) => {
      type: "SignInStatus";
      data: {
        address: string;
        ids: readonly string[];
        auth: readonly ("oauth" | "token")[];
        signedIn: boolean;
        method?: "oauth" | "token" | undefined;
      };
    };
  };
  SignInStatuses: z.ZodObject<
    {
      type: z.ZodLiteral<"SignInStatuses">;
      data: z.ZodObject<
        {
          signInStatuses: z.ZodReadonly<
            z.ZodArray<
              z.ZodObject<
                {
                  type: z.ZodLiteral<"SignInStatus">;
                  data: z.ZodObject<
                    {
                      address: z.ZodString;
                      ids: z.ZodReadonly<z.ZodArray<z.ZodString>>;
                      auth: z.ZodReadonly<
                        z.ZodArray<
                          z.ZodEnum<{
                            oauth: "oauth";
                            token: "token";
                          }>
                        >
                      >;
                      signedIn: z.ZodBoolean;
                      method: z.ZodOptional<
                        z.ZodEnum<{
                          oauth: "oauth";
                          token: "token";
                        }>
                      >;
                    },
                    z.core.$strip
                  >;
                },
                z.core.$strip
              > & {
                of: (dataValue: {
                  address: string;
                  ids: readonly string[];
                  auth: readonly ("oauth" | "token")[];
                  signedIn: boolean;
                  method?: "oauth" | "token" | undefined;
                }) => {
                  type: "SignInStatus";
                  data: {
                    address: string;
                    ids: readonly string[];
                    auth: readonly ("oauth" | "token")[];
                    signedIn: boolean;
                    method?: "oauth" | "token" | undefined;
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
      signInStatuses: readonly {
        type: "SignInStatus";
        data: {
          address: string;
          ids: readonly string[];
          auth: readonly ("oauth" | "token")[];
          signedIn: boolean;
          method?: "oauth" | "token" | undefined;
        };
      }[];
    }) => {
      type: "SignInStatuses";
      data: {
        signInStatuses: readonly {
          type: "SignInStatus";
          data: {
            address: string;
            ids: readonly string[];
            auth: readonly ("oauth" | "token")[];
            signedIn: boolean;
            method?: "oauth" | "token" | undefined;
          };
        }[];
      };
    };
  };
  ServedTool: z.ZodObject<
    {
      type: z.ZodLiteral<"ServedTool">;
      data: z.ZodObject<
        {
          name: z.ZodString;
          description: z.ZodString;
          inputSchema: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        },
        z.core.$strip
      >;
    },
    z.core.$strip
  > & {
    of: (dataValue: { name: string; description: string; inputSchema: Record<string, unknown> }) => {
      type: "ServedTool";
      data: {
        name: string;
        description: string;
        inputSchema: Record<string, unknown>;
      };
    };
  };
  ServedTools: z.ZodObject<
    {
      type: z.ZodLiteral<"ServedTools">;
      data: z.ZodObject<
        {
          tools: z.ZodReadonly<
            z.ZodArray<
              z.ZodObject<
                {
                  type: z.ZodLiteral<"ServedTool">;
                  data: z.ZodObject<
                    {
                      name: z.ZodString;
                      description: z.ZodString;
                      inputSchema: z.ZodRecord<z.ZodString, z.ZodUnknown>;
                    },
                    z.core.$strip
                  >;
                },
                z.core.$strip
              > & {
                of: (dataValue: { name: string; description: string; inputSchema: Record<string, unknown> }) => {
                  type: "ServedTool";
                  data: {
                    name: string;
                    description: string;
                    inputSchema: Record<string, unknown>;
                  };
                };
              }
            >
          >;
          problems: z.ZodReadonly<z.ZodArray<z.ZodString>>;
        },
        z.core.$strip
      >;
    },
    z.core.$strip
  > & {
    of: (dataValue: {
      tools: readonly {
        type: "ServedTool";
        data: {
          name: string;
          description: string;
          inputSchema: Record<string, unknown>;
        };
      }[];
      problems: readonly string[];
    }) => {
      type: "ServedTools";
      data: {
        tools: readonly {
          type: "ServedTool";
          data: {
            name: string;
            description: string;
            inputSchema: Record<string, unknown>;
          };
        }[];
        problems: readonly string[];
      };
    };
  };
  VendorPrimitive: z.ZodObject<
    {
      type: z.ZodLiteral<"VendorPrimitive">;
      data: z.ZodObject<
        {
          kind: z.ZodString;
          id: z.ZodString;
          description: z.ZodString;
          leftOutHeaders: z.ZodReadonly<z.ZodArray<z.ZodString>>;
        },
        z.core.$strip
      >;
    },
    z.core.$strip
  > & {
    of: (dataValue: { kind: string; id: string; description: string; leftOutHeaders: readonly string[] }) => {
      type: "VendorPrimitive";
      data: {
        kind: string;
        id: string;
        description: string;
        leftOutHeaders: readonly string[];
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
  AccessToken: z.ZodObject<
    {
      type: z.ZodLiteral<"AccessToken">;
      data: z.ZodObject<
        {
          accessToken: z.ZodString;
        },
        z.core.$strip
      >;
    },
    z.core.$strip
  > & {
    of: (dataValue: { accessToken: string }) => {
      type: "AccessToken";
      data: {
        accessToken: string;
      };
    };
  };
  DeclaredTool: z.ZodObject<
    {
      type: z.ZodLiteral<"DeclaredTool">;
      data: z.ZodObject<
        {
          servedName: z.ZodString;
          tool: z.ZodString;
          mcpId: z.ZodString;
          origin: z.ZodObject<
            {
              address: z.ZodString;
              endpoint: z.ZodOptional<z.ZodString>;
              command: z.ZodOptional<
                z.ZodObject<
                  {
                    command: z.ZodString;
                    args: z.ZodReadonly<z.ZodArray<z.ZodString>>;
                    tokenEnv: z.ZodOptional<z.ZodString>;
                  },
                  z.core.$strip
                >
              >;
              path: z.ZodOptional<z.ZodString>;
              auth: z.ZodReadonly<z.ZodArray<z.ZodString>>;
            },
            z.core.$strip
          >;
        },
        z.core.$strip
      >;
    },
    z.core.$strip
  > & {
    of: (dataValue: {
      servedName: string;
      tool: string;
      mcpId: string;
      origin: {
        address: string;
        auth: readonly string[];
        endpoint?: string | undefined;
        command?:
          | {
              command: string;
              args: readonly string[];
              tokenEnv?: string | undefined;
            }
          | undefined;
        path?: string | undefined;
      };
    }) => {
      type: "DeclaredTool";
      data: {
        servedName: string;
        tool: string;
        mcpId: string;
        origin: {
          address: string;
          auth: readonly string[];
          endpoint?: string | undefined;
          command?:
            | {
                command: string;
                args: readonly string[];
                tokenEnv?: string | undefined;
              }
            | undefined;
          path?: string | undefined;
        };
      };
    };
  };
  DeclaredTools: z.ZodObject<
    {
      type: z.ZodLiteral<"DeclaredTools">;
      data: z.ZodObject<
        {
          tools: z.ZodReadonly<
            z.ZodArray<
              z.ZodObject<
                {
                  type: z.ZodLiteral<"DeclaredTool">;
                  data: z.ZodObject<
                    {
                      servedName: z.ZodString;
                      tool: z.ZodString;
                      mcpId: z.ZodString;
                      origin: z.ZodObject<
                        {
                          address: z.ZodString;
                          endpoint: z.ZodOptional<z.ZodString>;
                          command: z.ZodOptional<
                            z.ZodObject<
                              {
                                command: z.ZodString;
                                args: z.ZodReadonly<z.ZodArray<z.ZodString>>;
                                tokenEnv: z.ZodOptional<z.ZodString>;
                              },
                              z.core.$strip
                            >
                          >;
                          path: z.ZodOptional<z.ZodString>;
                          auth: z.ZodReadonly<z.ZodArray<z.ZodString>>;
                        },
                        z.core.$strip
                      >;
                    },
                    z.core.$strip
                  >;
                },
                z.core.$strip
              > & {
                of: (dataValue: {
                  servedName: string;
                  tool: string;
                  mcpId: string;
                  origin: {
                    address: string;
                    auth: readonly string[];
                    endpoint?: string | undefined;
                    command?:
                      | {
                          command: string;
                          args: readonly string[];
                          tokenEnv?: string | undefined;
                        }
                      | undefined;
                    path?: string | undefined;
                  };
                }) => {
                  type: "DeclaredTool";
                  data: {
                    servedName: string;
                    tool: string;
                    mcpId: string;
                    origin: {
                      address: string;
                      auth: readonly string[];
                      endpoint?: string | undefined;
                      command?:
                        | {
                            command: string;
                            args: readonly string[];
                            tokenEnv?: string | undefined;
                          }
                        | undefined;
                      path?: string | undefined;
                    };
                  };
                };
              }
            >
          >;
          problems: z.ZodReadonly<z.ZodArray<z.ZodString>>;
        },
        z.core.$strip
      >;
    },
    z.core.$strip
  > & {
    of: (dataValue: {
      tools: readonly {
        type: "DeclaredTool";
        data: {
          servedName: string;
          tool: string;
          mcpId: string;
          origin: {
            address: string;
            auth: readonly string[];
            endpoint?: string | undefined;
            command?:
              | {
                  command: string;
                  args: readonly string[];
                  tokenEnv?: string | undefined;
                }
              | undefined;
            path?: string | undefined;
          };
        };
      }[];
      problems: readonly string[];
    }) => {
      type: "DeclaredTools";
      data: {
        tools: readonly {
          type: "DeclaredTool";
          data: {
            servedName: string;
            tool: string;
            mcpId: string;
            origin: {
              address: string;
              auth: readonly string[];
              endpoint?: string | undefined;
              command?:
                | {
                    command: string;
                    args: readonly string[];
                    tokenEnv?: string | undefined;
                  }
                | undefined;
              path?: string | undefined;
            };
          };
        }[];
        problems: readonly string[];
      };
    };
  };
  SensorCommands: z.ZodObject<
    {
      type: z.ZodLiteral<"SensorCommands">;
      data: z.ZodObject<
        {
          commands: z.ZodReadonly<z.ZodArray<z.ZodString>>;
        },
        z.core.$strip
      >;
    },
    z.core.$strip
  > & {
    of: (dataValue: { commands: readonly string[] }) => {
      type: "SensorCommands";
      data: {
        commands: readonly string[];
      };
    };
  };
  MainContextTexts: z.ZodObject<
    {
      type: z.ZodLiteral<"MainContextTexts">;
      data: z.ZodObject<
        {
          agents: z.ZodReadonly<
            z.ZodArray<
              z.ZodObject<
                {
                  agent: z.ZodString;
                  texts: z.ZodReadonly<
                    z.ZodArray<
                      z.ZodObject<
                        {
                          id: z.ZodString;
                          kind: z.ZodString;
                          text: z.ZodString;
                          globs: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
                        },
                        z.core.$strip
                      >
                    >
                  >;
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
      agents: readonly {
        agent: string;
        texts: readonly {
          id: string;
          kind: string;
          text: string;
          globs?: readonly string[] | undefined;
        }[];
      }[];
    }) => {
      type: "MainContextTexts";
      data: {
        agents: readonly {
          agent: string;
          texts: readonly {
            id: string;
            kind: string;
            text: string;
            globs?: readonly string[] | undefined;
          }[];
        }[];
      };
    };
  };
  EvalCases: z.ZodObject<
    {
      type: z.ZodLiteral<"EvalCases">;
      data: z.ZodObject<
        {
          cases: z.ZodReadonly<
            z.ZodArray<
              z.ZodObject<
                {
                  suiteName: z.ZodString;
                  prompt: z.ZodString;
                  expect: z.ZodObject<
                    {
                      invoke: z.ZodOptional<z.ZodString>;
                      follow: z.ZodOptional<z.ZodString>;
                      read: z.ZodOptional<z.ZodString>;
                      maxTokens: z.ZodOptional<z.ZodNumber>;
                    },
                    z.core.$strip
                  >;
                  guideBody: z.ZodOptional<z.ZodString>;
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
      cases: readonly {
        suiteName: string;
        prompt: string;
        expect: {
          invoke?: string | undefined;
          follow?: string | undefined;
          read?: string | undefined;
          maxTokens?: number | undefined;
        };
        guideBody?: string | undefined;
      }[];
    }) => {
      type: "EvalCases";
      data: {
        cases: readonly {
          suiteName: string;
          prompt: string;
          expect: {
            invoke?: string | undefined;
            follow?: string | undefined;
            read?: string | undefined;
            maxTokens?: number | undefined;
          };
          guideBody?: string | undefined;
        }[];
      };
    };
  };
  CharterLayout: z.ZodObject<
    {
      type: z.ZodLiteral<"CharterLayout">;
      data: z.ZodObject<
        {
          charterUri: z.ZodString;
        },
        z.core.$strip
      >;
    },
    z.core.$strip
  > & {
    of: (dataValue: { charterUri: string }) => {
      type: "CharterLayout";
      data: {
        charterUri: string;
      };
    };
  };
  DoctorOutcome: z.ZodObject<
    {
      type: z.ZodLiteral<"DoctorOutcome">;
      data: z.ZodObject<
        {
          agents: z.ZodReadonly<z.ZodArray<z.ZodString>>;
          errorCount: z.ZodNumber;
          warnCount: z.ZodNumber;
          pendingCount: z.ZodNullable<z.ZodNumber>;
          faultsByFile: z.ZodObject<
            {
              type: z.ZodLiteral<"FaultsByFile">;
              data: z.ZodObject<
                {
                  files: z.ZodRecord<
                    z.ZodString,
                    z.ZodReadonly<
                      z.ZodArray<
                        z.ZodObject<
                          {
                            type: z.ZodLiteral<"Fault">;
                            data: z.ZodObject<
                              {
                                name: z.ZodString;
                                message: z.ZodString;
                                fix: z.ZodString;
                                severity: z.ZodEnum<{
                                  error: "error";
                                  warn: "warn";
                                }>;
                              },
                              z.core.$strip
                            >;
                          },
                          z.core.$strip
                        > & {
                          of: (dataValue: {
                            name: string;
                            message: string;
                            fix: string;
                            severity: "error" | "warn";
                          }) => {
                            type: "Fault";
                            data: {
                              name: string;
                              message: string;
                              fix: string;
                              severity: "error" | "warn";
                            };
                          };
                        }
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
              files: Record<
                string,
                readonly {
                  type: "Fault";
                  data: {
                    name: string;
                    message: string;
                    fix: string;
                    severity: "error" | "warn";
                  };
                }[]
              >;
            }) => {
              type: "FaultsByFile";
              data: {
                files: Record<
                  string,
                  readonly {
                    type: "Fault";
                    data: {
                      name: string;
                      message: string;
                      fix: string;
                      severity: "error" | "warn";
                    };
                  }[]
                >;
              };
            };
          };
          problemCount: z.ZodNumber;
          mainContexts: z.ZodReadonly<
            z.ZodArray<
              z.ZodObject<
                {
                  agent: z.ZodString;
                  totalTokens: z.ZodNumber;
                },
                z.core.$strip
              >
            >
          >;
          mainContextCeiling: z.ZodNumber;
        },
        z.core.$strip
      >;
    },
    z.core.$strip
  > & {
    of: (dataValue: {
      agents: readonly string[];
      errorCount: number;
      warnCount: number;
      pendingCount: number | null;
      faultsByFile: {
        type: "FaultsByFile";
        data: {
          files: Record<
            string,
            readonly {
              type: "Fault";
              data: {
                name: string;
                message: string;
                fix: string;
                severity: "error" | "warn";
              };
            }[]
          >;
        };
      };
      problemCount: number;
      mainContexts: readonly {
        agent: string;
        totalTokens: number;
      }[];
      mainContextCeiling: number;
    }) => {
      type: "DoctorOutcome";
      data: {
        agents: readonly string[];
        errorCount: number;
        warnCount: number;
        pendingCount: number | null;
        faultsByFile: {
          type: "FaultsByFile";
          data: {
            files: Record<
              string,
              readonly {
                type: "Fault";
                data: {
                  name: string;
                  message: string;
                  fix: string;
                  severity: "error" | "warn";
                };
              }[]
            >;
          };
        };
        problemCount: number;
        mainContexts: readonly {
          agent: string;
          totalTokens: number;
        }[];
        mainContextCeiling: number;
      };
    };
  };
  ExplanationOutcome: z.ZodObject<
    {
      type: z.ZodLiteral<"ExplanationOutcome">;
      data: z.ZodObject<
        {
          primitive: z.ZodObject<
            {
              type: z.ZodLiteral<"Primitive">;
              data: z.ZodObject<
                {
                  id: z.ZodString;
                  kind: z.ZodString;
                  description: z.ZodString;
                  file: z.ZodString;
                  layerName: z.ZodEnum<{
                    repo: "repo";
                    vendor: "vendor";
                    builtin: "builtin";
                  }>;
                  headers: z.ZodRecord<
                    z.ZodString,
                    z.ZodUnion<readonly [z.ZodString, z.ZodReadonly<z.ZodArray<z.ZodString>>]>
                  >;
                  body: z.ZodString;
                  hash: z.ZodString;
                },
                z.core.$strip
              >;
            },
            z.core.$strip
          > & {
            of: (dataValue: {
              id: string;
              kind: string;
              description: string;
              file: string;
              layerName: "repo" | "vendor" | "builtin";
              headers: Record<string, string | readonly string[]>;
              body: string;
              hash: string;
            }) => {
              type: "Primitive";
              data: {
                id: string;
                kind: string;
                description: string;
                file: string;
                layerName: "repo" | "vendor" | "builtin";
                headers: Record<string, string | readonly string[]>;
                body: string;
                hash: string;
              };
            };
          };
          activatesWhen: z.ZodString;
          useMixins: z.ZodReadonly<
            z.ZodArray<
              z.ZodObject<
                {
                  type: z.ZodLiteral<"Primitive">;
                  data: z.ZodObject<
                    {
                      id: z.ZodString;
                      kind: z.ZodString;
                      description: z.ZodString;
                      file: z.ZodString;
                      layerName: z.ZodEnum<{
                        repo: "repo";
                        vendor: "vendor";
                        builtin: "builtin";
                      }>;
                      headers: z.ZodRecord<
                        z.ZodString,
                        z.ZodUnion<readonly [z.ZodString, z.ZodReadonly<z.ZodArray<z.ZodString>>]>
                      >;
                      body: z.ZodString;
                      hash: z.ZodString;
                    },
                    z.core.$strip
                  >;
                },
                z.core.$strip
              > & {
                of: (dataValue: {
                  id: string;
                  kind: string;
                  description: string;
                  file: string;
                  layerName: "repo" | "vendor" | "builtin";
                  headers: Record<string, string | readonly string[]>;
                  body: string;
                  hash: string;
                }) => {
                  type: "Primitive";
                  data: {
                    id: string;
                    kind: string;
                    description: string;
                    file: string;
                    layerName: "repo" | "vendor" | "builtin";
                    headers: Record<string, string | readonly string[]>;
                    body: string;
                    hash: string;
                  };
                };
              }
            >
          >;
          rationale: z.ZodOptional<
            z.ZodObject<
              {
                type: z.ZodLiteral<"Primitive">;
                data: z.ZodObject<
                  {
                    id: z.ZodString;
                    kind: z.ZodString;
                    description: z.ZodString;
                    file: z.ZodString;
                    layerName: z.ZodEnum<{
                      repo: "repo";
                      vendor: "vendor";
                      builtin: "builtin";
                    }>;
                    headers: z.ZodRecord<
                      z.ZodString,
                      z.ZodUnion<readonly [z.ZodString, z.ZodReadonly<z.ZodArray<z.ZodString>>]>
                    >;
                    body: z.ZodString;
                    hash: z.ZodString;
                  },
                  z.core.$strip
                >;
              },
              z.core.$strip
            > & {
              of: (dataValue: {
                id: string;
                kind: string;
                description: string;
                file: string;
                layerName: "repo" | "vendor" | "builtin";
                headers: Record<string, string | readonly string[]>;
                body: string;
                hash: string;
              }) => {
                type: "Primitive";
                data: {
                  id: string;
                  kind: string;
                  description: string;
                  file: string;
                  layerName: "repo" | "vendor" | "builtin";
                  headers: Record<string, string | readonly string[]>;
                  body: string;
                  hash: string;
                };
              };
            }
          >;
          hosts: z.ZodReadonly<
            z.ZodArray<
              z.ZodObject<
                {
                  type: z.ZodLiteral<"Primitive">;
                  data: z.ZodObject<
                    {
                      id: z.ZodString;
                      kind: z.ZodString;
                      description: z.ZodString;
                      file: z.ZodString;
                      layerName: z.ZodEnum<{
                        repo: "repo";
                        vendor: "vendor";
                        builtin: "builtin";
                      }>;
                      headers: z.ZodRecord<
                        z.ZodString,
                        z.ZodUnion<readonly [z.ZodString, z.ZodReadonly<z.ZodArray<z.ZodString>>]>
                      >;
                      body: z.ZodString;
                      hash: z.ZodString;
                    },
                    z.core.$strip
                  >;
                },
                z.core.$strip
              > & {
                of: (dataValue: {
                  id: string;
                  kind: string;
                  description: string;
                  file: string;
                  layerName: "repo" | "vendor" | "builtin";
                  headers: Record<string, string | readonly string[]>;
                  body: string;
                  hash: string;
                }) => {
                  type: "Primitive";
                  data: {
                    id: string;
                    kind: string;
                    description: string;
                    file: string;
                    layerName: "repo" | "vendor" | "builtin";
                    headers: Record<string, string | readonly string[]>;
                    body: string;
                    hash: string;
                  };
                };
              }
            >
          >;
          citers: z.ZodReadonly<
            z.ZodArray<
              z.ZodObject<
                {
                  type: z.ZodLiteral<"Primitive">;
                  data: z.ZodObject<
                    {
                      id: z.ZodString;
                      kind: z.ZodString;
                      description: z.ZodString;
                      file: z.ZodString;
                      layerName: z.ZodEnum<{
                        repo: "repo";
                        vendor: "vendor";
                        builtin: "builtin";
                      }>;
                      headers: z.ZodRecord<
                        z.ZodString,
                        z.ZodUnion<readonly [z.ZodString, z.ZodReadonly<z.ZodArray<z.ZodString>>]>
                      >;
                      body: z.ZodString;
                      hash: z.ZodString;
                    },
                    z.core.$strip
                  >;
                },
                z.core.$strip
              > & {
                of: (dataValue: {
                  id: string;
                  kind: string;
                  description: string;
                  file: string;
                  layerName: "repo" | "vendor" | "builtin";
                  headers: Record<string, string | readonly string[]>;
                  body: string;
                  hash: string;
                }) => {
                  type: "Primitive";
                  data: {
                    id: string;
                    kind: string;
                    description: string;
                    file: string;
                    layerName: "repo" | "vendor" | "builtin";
                    headers: Record<string, string | readonly string[]>;
                    body: string;
                    hash: string;
                  };
                };
              }
            >
          >;
          mentioners: z.ZodReadonly<
            z.ZodArray<
              z.ZodObject<
                {
                  type: z.ZodLiteral<"Primitive">;
                  data: z.ZodObject<
                    {
                      id: z.ZodString;
                      kind: z.ZodString;
                      description: z.ZodString;
                      file: z.ZodString;
                      layerName: z.ZodEnum<{
                        repo: "repo";
                        vendor: "vendor";
                        builtin: "builtin";
                      }>;
                      headers: z.ZodRecord<
                        z.ZodString,
                        z.ZodUnion<readonly [z.ZodString, z.ZodReadonly<z.ZodArray<z.ZodString>>]>
                      >;
                      body: z.ZodString;
                      hash: z.ZodString;
                    },
                    z.core.$strip
                  >;
                },
                z.core.$strip
              > & {
                of: (dataValue: {
                  id: string;
                  kind: string;
                  description: string;
                  file: string;
                  layerName: "repo" | "vendor" | "builtin";
                  headers: Record<string, string | readonly string[]>;
                  body: string;
                  hash: string;
                }) => {
                  type: "Primitive";
                  data: {
                    id: string;
                    kind: string;
                    description: string;
                    file: string;
                    layerName: "repo" | "vendor" | "builtin";
                    headers: Record<string, string | readonly string[]>;
                    body: string;
                    hash: string;
                  };
                };
              }
            >
          >;
          testCasesByFile: z.ZodObject<
            {
              type: z.ZodLiteral<"TestCasesByFile">;
              data: z.ZodRecord<z.ZodString, z.ZodReadonly<z.ZodArray<z.ZodString>>>;
            },
            z.core.$strip
          > & {
            of: (dataValue: Record<string, readonly string[]>) => {
              type: "TestCasesByFile";
              data: Record<string, readonly string[]>;
            };
          };
        },
        z.core.$strip
      >;
    },
    z.core.$strip
  > & {
    of: (dataValue: {
      primitive: {
        type: "Primitive";
        data: {
          id: string;
          kind: string;
          description: string;
          file: string;
          layerName: "repo" | "vendor" | "builtin";
          headers: Record<string, string | readonly string[]>;
          body: string;
          hash: string;
        };
      };
      activatesWhen: string;
      useMixins: readonly {
        type: "Primitive";
        data: {
          id: string;
          kind: string;
          description: string;
          file: string;
          layerName: "repo" | "vendor" | "builtin";
          headers: Record<string, string | readonly string[]>;
          body: string;
          hash: string;
        };
      }[];
      hosts: readonly {
        type: "Primitive";
        data: {
          id: string;
          kind: string;
          description: string;
          file: string;
          layerName: "repo" | "vendor" | "builtin";
          headers: Record<string, string | readonly string[]>;
          body: string;
          hash: string;
        };
      }[];
      citers: readonly {
        type: "Primitive";
        data: {
          id: string;
          kind: string;
          description: string;
          file: string;
          layerName: "repo" | "vendor" | "builtin";
          headers: Record<string, string | readonly string[]>;
          body: string;
          hash: string;
        };
      }[];
      mentioners: readonly {
        type: "Primitive";
        data: {
          id: string;
          kind: string;
          description: string;
          file: string;
          layerName: "repo" | "vendor" | "builtin";
          headers: Record<string, string | readonly string[]>;
          body: string;
          hash: string;
        };
      }[];
      testCasesByFile: {
        type: "TestCasesByFile";
        data: Record<string, readonly string[]>;
      };
      rationale?:
        | {
            type: "Primitive";
            data: {
              id: string;
              kind: string;
              description: string;
              file: string;
              layerName: "repo" | "vendor" | "builtin";
              headers: Record<string, string | readonly string[]>;
              body: string;
              hash: string;
            };
          }
        | undefined;
    }) => {
      type: "ExplanationOutcome";
      data: {
        primitive: {
          type: "Primitive";
          data: {
            id: string;
            kind: string;
            description: string;
            file: string;
            layerName: "repo" | "vendor" | "builtin";
            headers: Record<string, string | readonly string[]>;
            body: string;
            hash: string;
          };
        };
        activatesWhen: string;
        useMixins: readonly {
          type: "Primitive";
          data: {
            id: string;
            kind: string;
            description: string;
            file: string;
            layerName: "repo" | "vendor" | "builtin";
            headers: Record<string, string | readonly string[]>;
            body: string;
            hash: string;
          };
        }[];
        hosts: readonly {
          type: "Primitive";
          data: {
            id: string;
            kind: string;
            description: string;
            file: string;
            layerName: "repo" | "vendor" | "builtin";
            headers: Record<string, string | readonly string[]>;
            body: string;
            hash: string;
          };
        }[];
        citers: readonly {
          type: "Primitive";
          data: {
            id: string;
            kind: string;
            description: string;
            file: string;
            layerName: "repo" | "vendor" | "builtin";
            headers: Record<string, string | readonly string[]>;
            body: string;
            hash: string;
          };
        }[];
        mentioners: readonly {
          type: "Primitive";
          data: {
            id: string;
            kind: string;
            description: string;
            file: string;
            layerName: "repo" | "vendor" | "builtin";
            headers: Record<string, string | readonly string[]>;
            body: string;
            hash: string;
          };
        }[];
        testCasesByFile: {
          type: "TestCasesByFile";
          data: Record<string, readonly string[]>;
        };
        rationale?:
          | {
              type: "Primitive";
              data: {
                id: string;
                kind: string;
                description: string;
                file: string;
                layerName: "repo" | "vendor" | "builtin";
                headers: Record<string, string | readonly string[]>;
                body: string;
                hash: string;
              };
            }
          | undefined;
      };
    };
  };
  VendorAddOutcome: z.ZodObject<
    {
      type: z.ZodLiteral<"VendorAddOutcome">;
      data: z.ZodReadonly<
        z.ZodArray<
          z.ZodObject<
            {
              folder: z.ZodString;
              primitives: z.ZodReadonly<
                z.ZodArray<
                  z.ZodObject<
                    {
                      type: z.ZodLiteral<"VendorPrimitive">;
                      data: z.ZodObject<
                        {
                          kind: z.ZodString;
                          id: z.ZodString;
                          description: z.ZodString;
                          leftOutHeaders: z.ZodReadonly<z.ZodArray<z.ZodString>>;
                        },
                        z.core.$strip
                      >;
                    },
                    z.core.$strip
                  > & {
                    of: (dataValue: {
                      kind: string;
                      id: string;
                      description: string;
                      leftOutHeaders: readonly string[];
                    }) => {
                      type: "VendorPrimitive";
                      data: {
                        kind: string;
                        id: string;
                        description: string;
                        leftOutHeaders: readonly string[];
                      };
                    };
                  }
                >
              >;
            },
            z.core.$strip
          >
        >
      >;
    },
    z.core.$strip
  > & {
    of: (
      dataValue: readonly {
        folder: string;
        primitives: readonly {
          type: "VendorPrimitive";
          data: {
            kind: string;
            id: string;
            description: string;
            leftOutHeaders: readonly string[];
          };
        }[];
      }[],
    ) => {
      type: "VendorAddOutcome";
      data: readonly {
        folder: string;
        primitives: readonly {
          type: "VendorPrimitive";
          data: {
            kind: string;
            id: string;
            description: string;
            leftOutHeaders: readonly string[];
          };
        }[];
      }[];
    };
  };
};

/** Every DTO's type, under its name: what its schema infers. */
declare namespace CharterDTOs {
  type AccessToken = z.infer<typeof CharterDTOs.AccessToken>;
  type Catalogue = z.infer<typeof CharterDTOs.Catalogue>;
  type CatalogueEntry = z.infer<typeof CharterDTOs.CatalogueEntry>;
  type CharterLayout = z.infer<typeof CharterDTOs.CharterLayout>;
  type DeclaredTool = z.infer<typeof CharterDTOs.DeclaredTool>;
  type DeclaredTools = z.infer<typeof CharterDTOs.DeclaredTools>;
  type DoctorOutcome = z.infer<typeof CharterDTOs.DoctorOutcome>;
  type EvalCase = z.infer<typeof CharterDTOs.EvalCase>;
  type EvalCases = z.infer<typeof CharterDTOs.EvalCases>;
  type EvalSuite = z.infer<typeof CharterDTOs.EvalSuite>;
  type EvalSuiteName = z.infer<typeof CharterDTOs.EvalSuiteName>;
  type EvalSuites = z.infer<typeof CharterDTOs.EvalSuites>;
  type ExplanationOutcome = z.infer<typeof CharterDTOs.ExplanationOutcome>;
  type MainContext = z.infer<typeof CharterDTOs.MainContext>;
  type MainContextLoad = z.infer<typeof CharterDTOs.MainContextLoad>;
  type MainContextTexts = z.infer<typeof CharterDTOs.MainContextTexts>;
  type MainContexts = z.infer<typeof CharterDTOs.MainContexts>;
  type PlanSummary = z.infer<typeof CharterDTOs.PlanSummary>;
  type Primitive = z.infer<typeof CharterDTOs.Primitive>;
  type PrimitiveHeader = z.infer<typeof CharterDTOs.PrimitiveHeader>;
  type PrimitiveKinds = z.infer<typeof CharterDTOs.PrimitiveKinds>;
  type PrimitiveRequirements = z.infer<typeof CharterDTOs.PrimitiveRequirements>;
  type Primitives = z.infer<typeof CharterDTOs.Primitives>;
  type SensorCommands = z.infer<typeof CharterDTOs.SensorCommands>;
  type ServedTool = z.infer<typeof CharterDTOs.ServedTool>;
  type ServedTools = z.infer<typeof CharterDTOs.ServedTools>;
  type SignInStatus = z.infer<typeof CharterDTOs.SignInStatus>;
  type SignInStatuses = z.infer<typeof CharterDTOs.SignInStatuses>;
  type TestCase = z.infer<typeof CharterDTOs.TestCase>;
  type TestCaseReport = z.infer<typeof CharterDTOs.TestCaseReport>;
  type TestCasesByFile = z.infer<typeof CharterDTOs.TestCasesByFile>;
  type TestRunReport = z.infer<typeof CharterDTOs.TestRunReport>;
  type TestSuite = z.infer<typeof CharterDTOs.TestSuite>;
  type TestSuiteName = z.infer<typeof CharterDTOs.TestSuiteName>;
  type TestSuites = z.infer<typeof CharterDTOs.TestSuites>;
  type VendorAddOutcome = z.infer<typeof CharterDTOs.VendorAddOutcome>;
  type VendorFolder = z.infer<typeof CharterDTOs.VendorFolder>;
  type VendorFolders = z.infer<typeof CharterDTOs.VendorFolders>;
  type VendorPrimitive = z.infer<typeof CharterDTOs.VendorPrimitive>;
}

/**
 * DRIVER PORT — charter authoring: its primitives, the vendors it
 * installs, the test and eval cases written beside it, testing it, and the mcp
 * origins it reaches, signed in to (CORE-FR-222). Runtime asks it, through
 * this port alone, for a token to an mcp origin (CORE-FR-229).
 *
 * What is authored is what a repository keeps, so nothing here reads what the
 * repository configured itself with, and nothing needs it to be under version
 * control: a vendor's source is fetched, and nothing of the repository's own
 * history is asked. Its settings are the build's.
 *
 * Every answer is a DTO, told apart from the others it may be by its `type`: a
 * driver reads what the engine said and never holds a model of the engine's.
 * Whatever stops an operation is among them, a `FaultDTOs.Fault`, and never
 * thrown: an internal one is logged and said in the system's own words
 * (SDK-FR-004, SDK-FR-017, SDK-FR-018).
 */
interface ForAuthoringCharter {
  /**
   * What this repository's charter holds, listed (FR-011, FR-012).
   *
   * Reads and says: there is no way through this to write anything (FR-041).
   * What comes back is the listing the charter compiles to and not a second
   * one made for this command, so what a user reads and what an agent reads
   * are the same listing said twice (SC-004).
   *
   * Narrowed to one kind where a kind is named, and the whole charter where none
   * is. The word is taken as typed: whether it is a kind at all is asked behind
   * this port, and a word that is none is answered as one fault rather than under a file, since it
   * leaves nothing to narrow by and there is no file it is wrong with.
   *
   * A charter with an error is refused with nothing listed and the errors given
   * back, for the reason a build is: a listing of a charter that does not hold
   * would say a charter holds primitives it has not got (FR-009).
   */
  list(kind?: string): Promise<CharterDTOs.Catalogue | FaultDTOs.FaultsByFile | FaultDTOs.Fault>;
  /**
   * Every primitive of every layer, off the charter as it was read rather than
   * the catalogue it compiles to: each with its file, the layer it arrived in,
   * and every header it declared (FR-112, FR-114). What the portal lists by;
   * `list` stays what an agent surveys by.
   *
   * Given a word, only the primitives that mention it — in the id, the
   * kind, the description, when the kind comes up, the file or any header
   * value, ignoring case.
   *
   * A charter with an error is refused with nothing listed and the errors given
   * back, as `list` refuses it.
   */
  fullList(matching?: string): Promise<CharterDTOs.Primitives | FaultDTOs.FaultsByFile | FaultDTOs.Fault>;
  /**
   * Which file declares one id, and which layer that file arrived in
   * (FR-017, SC-006); the mixins it uses and the corpus it cites, and what
   * uses, cites or names it (FR-014, FR-163).
   *
   * Reads and says, as `list` does: there is no way through this to write
   * anything (FR-041).
   *
   * The id is taken as typed. Text that is not an id, `<kind>:<id>` among it, and an
   * id this charter holds nothing of, are answered as one fault rather than under a file,
   * for the reason an unknown kind is: there is no file it is wrong with, and
   * nothing to explain.
   *
   * A charter with an error explains nothing and hands the errors back, the way
   * a listing does: a charter that does not hold would answer for a primitive it
   * has not got (FR-009). The collision SC-006 asks about is among those errors,
   * naming both files that claim the id, so it is read where every other
   * fault is.
   */
  explain(id: string): Promise<CharterDTOs.ExplanationOutcome | FaultDTOs.FaultsByFile | FaultDTOs.Fault>;
  /**
   * What one kind takes of whoever authors a primitive of it: each header,
   * whether it holds a line or a list, and whether a file written without it is
   * refused (FR-004, FR-039).
   *
   * Every header the kind takes is named, not only the ones it refuses a file
   * without: a header an author may write is one they have to know the shape of,
   * and the shape is read off the same schema the file is refused against.
   *
   * Reads and says, as `list` does: there is no way through this to write
   * anything (FR-041). No charter is read either — what a kind demands is the
   * kind's own contract, and it is the same in a repository that has authored
   * nothing.
   *
   * What it is for is the asking: whoever has an author in front of them has one
   * question per header the kind requires, and does not have to know the kinds
   * to put them. A word
   * that is no kind is answered as one fault rather than under a file, the way a listing's is:
   * there is no file it is wrong with, and what comes back names every kind
   * there is.
   */
  listPrimitiveRequirements(kind: string): Promise<CharterDTOs.PrimitiveRequirements | FaultDTOs.Fault>;
  /**
   * Every kind the charter knows, and when a primitive of that kind comes up
   * (FR-010).
   *
   * Reads and says, and reads no charter either: what a kind is and when it
   * applies is the kind's own contract, so the answer is the same in a
   * repository that has authored nothing. The same declarations the compiled
   * orientation says it in, so a listing and what the agent reads cannot come to
   * say different things.
   *
   * What it is for is listing: whoever shows a charter shows it by kind, and the
   * kinds a charter holds nothing of are kinds all the same.
   */
  kinds(): Promise<CharterDTOs.PrimitiveKinds | FaultDTOs.Fault>;
  /**
   * One primitive written where its kind's primitives are authored (FR-039).
   *
   * Writes exactly one file. What arrives is what the kind was asked for —
   * `listPrimitiveRequirements` said which headers, and these are the
   * answers — so the asking belongs to whoever had an author to ask and the
   * checking belongs here: answers the kind refuses come back as the faults they
   * are and no file is written (FR-004). What it gives back is the primitive as
   * `explain` would say it — its id, the file it went into, this
   * repository's layer — so a caller can say it without going and looking.
   *
   * The body is what its author typed, and empty where none was: at the command
   * line the body is written in an editor afterwards (FR-117).
   *
   * Nothing is compiled: a build is the command that compiles a charter
   * (FR-020, FR-079).
   *
   * A word that is no kind, and an id the charter already holds in any
   * layer, are answered as one fault rather than under a file: neither leaves a file to report a
   * fault under, and the second names the file already holding it.
   */
  add(
    kind: string,
    id: string,
    headers: UnparsedHeaders,
    body?: string,
  ): Promise<CharterDTOs.Primitive | FaultDTOs.Faults | FaultDTOs.Fault>;
  /**
   * One primitive as the charter read it — its headers, its body, the file
   * and the layer — and the hash of it written out, what a save is made over
   * (FR-075, FR-078).
   *
   * Reads and says: there is no way through this to write anything (FR-041).
   * Asked of the files as read rather than of the validation, so a primitive
   * opens whatever else in the charter is wrong. An id the charter holds
   * nothing of is answered as a fault, as `explain` answers it.
   */
  open(id: string): Promise<CharterDTOs.Primitive | FaultDTOs.Fault>;
  /**
   * One repository primitive's headers and body written over, its kind, id and
   * file kept (FR-075).
   *
   * Refused, as a fault, with nothing written for a vendored or builtin primitive, naming
   * where it came from (FR-077), and for a primitive that, read again, no
   * longer has the hash it was opened at, `openedHash`, naming the file
   * (FR-078). Answers the kind will not take come back as the faults `add`
   * gives for them. Nothing is compiled or committed
   * (FR-079).
   */
  rewrite(
    id: string,
    headers: UnparsedHeaders,
    body: string,
    openedHash: string,
  ): Promise<CharterDTOs.Primitive | FaultDTOs.Faults | FaultDTOs.Fault>;
  /**
   * One repository primitive's file taken away, and nothing else (FR-076):
   * what still names it is reported dangling by the next validation. Refused, as a fault, for
   * a vendored or builtin primitive, as a rewrite is (FR-077). What comes back
   * is the primitive that was removed. Nothing is compiled or committed
   * (FR-079).
   */
  remove(id: string): Promise<CharterDTOs.Primitive | FaultDTOs.Fault>;
  /**
   * Install one source under this repository's vendor folder, pinned to this
   * version where one is named (FR-023, FR-027).
   *
   * The source is passed on as it was written: which transport it names and
   * whether the credentials for it are there is version control's business, and
   * what it says when it refuses is what the caller is told (FR-031).
   *
   * Installing one that is already there brings it up to date instead, so a
   * repository has one way of saying what it wants rather than two (FR-030).
   *
   * The folder need not be a repository; a machine without git is refused
   * (CORE-FR-205). What it installs is left unstaged for the user to read and
   * commit, whatever else is in hand (CORE-FR-190).
   *
   * What is taken is read off the source's shape where neither `selectedSkillIds` nor
   * `selectedCharterNames` is given: its one charter, else every charter under its
   * `charters/`, else every skill under its `skills/` (CORE-FR-193).
   * `selectedCharterNames` picks charters from `charters/`, each installed whole in a
   * vendor folder of its own (CORE-FR-195, CORE-FR-196); `selectedSkillIds` takes
   * skills from `skills/`, every one it holds where the shape takes them and
   * none is named, asking nothing (CORE-FR-184, CORE-FR-188).
   *
   * What it answers is each folder it filled, and the primitives installed
   * there, each skill with the headers its `SKILL.md` declared that were left
   * out (CORE-FR-186).
   */
  addVendor(
    sourceUri: string,
    version?: string,
    selectedSkillIds?: readonly string[],
    selectedCharterNames?: readonly string[],
  ): Promise<CharterDTOs.VendorAddOutcome | FaultDTOs.Fault>;
  /** Copy source primitives into the own charter, unstaged, refusing collisions before writing (CORE-FR-198–200). */
  injectVendor(
    sourceUri: string,
    version?: string,
    selectedSkillIds?: readonly string[],
    selectedCharterNames?: readonly string[],
  ): Promise<CharterDTOs.VendorAddOutcome | FaultDTOs.Fault>;
  /**
   * Take one installed charter away, named by the folder it was installed as
   * (FR-030), and answer that folder.
   *
   * Named by the folder rather than by the address it came from: the folder is
   * what a reader of this repository sees, and what the charter is read out of.
   *
   * Its folder is left gone in the working tree for the user to commit, whatever
   * else is in hand, in a repository or out of one. A name no vendor folder
   * answers to is refused, changing nothing (CORE-FR-204).
   */
  removeVendor(name: string): Promise<CharterDTOs.VendorFolder | FaultDTOs.Fault>;
  /**
   * Every folder a source was installed as, under this repository's vendor
   * folder, sorted (FR-053, FR-122).
   *
   * The folder is all there is to say: nothing is recorded of where one came
   * from or at which version, since version control keeps no such record
   * either and a record kept beside it is one more thing to drift (FR-046).
   */
  vendors(): Promise<CharterDTOs.VendorFolders | FaultDTOs.Fault>;
  /**
   * Every test file under `.cw/charter/test/`, run or not: its name, its text, and its
   * description and cases — or, for a file that does not read, why (FR-124).
   *
   * Reads and says, and reads no charter: nothing is resolved here, which is
   * what testing the charter does. A file that does not read is listed all the
   * same, since it is the one its author most needs to open.
   */
  suites(): Promise<CharterDTOs.TestSuites | FaultDTOs.Fault>;
  /**
   * A new test file, under a name no other test file has, holding one sample
   * case that reads as a suite (FR-091). What comes back is its name.
   */
  addSuite(): Promise<CharterDTOs.TestSuiteName | FaultDTOs.Fault>;
  /**
   * One existing test file written over with this text (FR-090). Text that does
   * not read as a suite is answered as a fault with the refusal and sample `cw test` gives,
   * and nothing is written; so is a name that is no test file. What comes back
   * is its name.
   */
  writeSuite(name: string, text: string): Promise<CharterDTOs.TestSuiteName | FaultDTOs.Fault>;
  /**
   * One test file taken away, and nothing else (FR-092). A name that is no test
   * file is answered as a fault. What comes back is its name.
   */
  removeSuite(name: string): Promise<CharterDTOs.TestSuiteName | FaultDTOs.Fault>;
  /**
   * Every file of evaluation cases, evaluated or not: its name, its text, and
   * its description and cases — or, for a file that does not read, why
   * (CORE-FR-222). Reads and says, and reads no charter: whether a case names
   * what the charter holds is evaluating's to say.
   */
  evalSuites(): Promise<CharterDTOs.EvalSuites | FaultDTOs.Fault>;
  /**
   * A new file of evaluation cases, under a name no other has, holding one
   * sample case that reads as a suite. What comes back is its name.
   */
  addEvalSuite(): Promise<CharterDTOs.EvalSuiteName | FaultDTOs.Fault>;
  /**
   * One existing file of evaluation cases written over with this text. Text
   * that does not read as a suite is answered as a fault, with a sample, and
   * nothing is written; so is a name that is no such file. What comes back is
   * its name.
   */
  writeEvalSuite(name: string, text: string): Promise<CharterDTOs.EvalSuiteName | FaultDTOs.Fault>;
  /**
   * One file of evaluation cases taken away, and nothing else. A name that is
   * no such file is answered as a fault. What comes back is its name.
   */
  removeEvalSuite(name: string): Promise<CharterDTOs.EvalSuiteName | FaultDTOs.Fault>;
  /**
   * Every address an mcp origin of the charter takes a sign-in at, ordered by
   * address, and whether the developer has signed in there (FR-150). Asks
   * nothing and changes nothing: a credential past its expiry is still signed
   * in, since it is renewed when it is used.
   */
  signInStatus(): Promise<CharterDTOs.SignInStatuses | FaultDTOs.Fault>;
  /**
   * Keep this token as the developer's credential at this address, replacing
   * whatever was kept there (FR-148, FR-149). Refused, keeping nothing, for an
   * address no mcp origin is at, one that takes no token, or an empty token.
   * What comes back is the address, signed in.
   */
  signInWithToken(address: string, token: string): Promise<CharterDTOs.SignInStatus | FaultDTOs.Fault>;
  /**
   * Sign in at this address in the developer's browser, and keep what the mcp origin
   * issued (FR-148). `showAuthorizationUrl` is handed the address to open.
   * Refused, keeping nothing, for an address no mcp origin is at or one that takes
   * no OAuth sign-in. What comes back is the address, signed in.
   */
  signInWithOAuth(
    address: string,
    showAuthorizationUrl: (authorizationUrl: string) => void,
  ): Promise<CharterDTOs.SignInStatus | FaultDTOs.Fault>;
  /**
   * Every situation this repository wrote down, resolved against its charter
   * (FR-048, FR-049, FR-050). Runs nothing, fetches nothing and asks no agent.
   * A charter with an error, or a test file that does not read, resolves
   * nothing and is answered as its faults (FR-009). Reads and says (FR-041).
   */
  test(): Promise<CharterDTOs.TestRunReport | FaultDTOs.FaultsByFile | FaultDTOs.Fault>;
  /**
   * A folder per kind for a charter to be authored in, and the parts kept
   * beside it, laid out where nothing is yet (FR-037, CORE-FR-224). Run again,
   * it discards nothing anybody wrote. What comes back is where the charter
   * is kept.
   */
  setUpCharter(): Promise<CharterDTOs.CharterLayout | FaultDTOs.Fault>;
  /** Where the charter is kept, refused where the repository is laid out the
   *  old way, naming the skill that moves it (CORE-FR-226): what a driver asks
   *  before any command. */
  layout(): Promise<CharterDTOs.CharterLayout | FaultDTOs.Fault>;
  /**
   * The developer's access token to this mcp origin, renewed first where it
   * has expired or `isRefused` says the mcp origin has just refused it (FR-151,
   * SC-035). An mcp origin nobody signed in to, or whose credential cannot be
   * renewed, is answered as a fault naming the command that signs in again; one
   * at plain `http` on another machine is refused before anything is read.
   */
  accessToken(
    mcpOriginAddress: McpOriginAddress,
    isRefused: boolean,
  ): Promise<CharterDTOs.AccessToken | FaultDTOs.Fault>;
}

/**
 * DRIVEN PORT — OAuth against one mcp origin: signing in, and renewing what a
 * sign-in ended with (FR-148, FR-151).
 *
 * Discovery, registration, PKCE and the callback are the adapter's business;
 * the hexagon hands it an endpoint and keeps what comes back.
 */
interface ForAuthorizingMcpOrigins {
  /**
   * Sign in to the server at this endpoint in the developer's browser.
   *
   * `showAuthorizationUrl` is handed the address to open, once: the adapter
   * never opens it (plan §15). Raises an `AdapterFault` where the server cannot
   * be reached, the developer refuses, or nobody comes back in time.
   */
  authorize(endpoint: string, showAuthorizationUrl: (authorizationUrl: string) => void): Promise<OAuthGrant>;
  /**
   * Renew one grant with its refresh token, asking nobody.
   *
   * `undefined` where the server refuses: the developer has to sign in again.
   * A server that cannot be reached raises an `AdapterFault` instead, since
   * nothing says the grant is no good.
   */
  renew(endpoint: string, oauthGrant: OAuthGrant): Promise<OAuthGrant | undefined>;
}

/** What an adapter answering this port raises when git refuses, named again
 *  here so it names this port and nothing behind it. */

/**
 * DRIVEN PORT — reaching a source. How it is answered — a git command today, a
 * library or a test's own answer tomorrow — is the adapter's business.
 *
 * The folder a source lands in need not be a repository: nothing here needs a
 * repository, and nothing here writes to one (FR-023, CORE-FR-205).
 */
interface ForFetchingCharterSources {
  /**
   * Fetch this source, at this version where one is named, and answer the
   * commit fetched: what the other questions about a source are asked of, so it
   * is fetched once. Its text is the adapter's own, for this port alone to
   * read. Nothing in the repository is touched; it is only what a relative source is
   * read from, and whose own version control settings reach it, where it has
   * any. Whoever fetched it says `forgetCommit` when done.
   *
   * A source that cannot be reached, a version that is not there, and a machine
   * that cannot fetch at all each raise an `AdapterFault` saying so
   * (CORE-FR-190, CORE-FR-205).
   */
  fetchCommit(source: string, version?: string): Promise<string>;
  /** Every file this fetched commit holds, by its path in it, at any depth, in
   *  no promised order. */
  listFilesAt(commit: string): Promise<readonly string[]>;
  /** What one file of this fetched commit holds, as text. */
  readFileAt(commit: string, path: string): Promise<string>;
  /** What one file of this fetched commit holds, as the bytes it holds, never
   *  decoded (CORE-FR-208). */
  readBytesAt(commit: string, path: string): Promise<Uint8Array>;
  /**
   * Put one folder of this fetched commit — every file under it, at any depth —
   * at this folder of this repository, replacing whatever that folder held and
   * nothing beside it. The empty path is the commit's root. Nothing is staged
   * and nothing is committed: what lands is left in the working tree for the
   * user to read, whatever else is in hand (FR-023, FR-042, CORE-FR-187,
   * CORE-FR-190).
   */
  checkoutFolderAt(commit: string, fromFolder: string, intoSubFolder: string): Promise<void>;
  /** Let go of what was kept of this fetched commit; nothing is asked of it
   *  afterwards. */
  forgetCommit(commit: string): Promise<void>;
}

/** Keeps the credentials of the mcp origins, wherever they are kept: what a
 *  credential holds is never shown, and no DTO carries one (SC-036). */
interface ForStoringCredentials {
  /** The credential kept under this address, or `undefined` where none is. One
   *  that does not read as a credential is none: signing in again replaces it. */
  readCredential(address: string): Promise<McpCredential | undefined>;
  /** Keep this credential under its address, replacing what was there. */
  writeCredential(credential: McpCredential): Promise<void>;
}

/**
 * DRIVER PORT — projecting the charter: the charter charter authoring keeps,
 * built and laid onto each agent provider the repository uses; the build and
 * its preview, the health check, the estimated main context, and what the
 * last build laid to be served or run — the tools of the mcp origins, the
 * sensors (CORE-FR-222). Runtime asks it, through this port alone, for the
 * mcp origins, the sensors of a signal, a build into a working copy, what an
 * agent is sent when a session opens, and an evaluation's cases
 * (CORE-FR-229).
 *
 * Which agents it builds for is what it was composed with, never what it reads
 * (CORE-FR-231). Every answer is a DTO, told apart from the others it may be
 * by its `type`; whatever stops an operation is among them, a
 * `FaultDTOs.Fault`, and never thrown (SDK-FR-004, SDK-FR-017, SDK-FR-018).
 */
interface ForBuildingCharter {
  /**
   * The three questions about this repository, asked in one go (FR-040): which
   * agents it compiles for, what validating its charter finds — its test files'
   * findings among it — and how many files a build would still change, with
   * the main context each agent opens with, estimated. Reads and says
   * (FR-041).
   */
  doctor(): Promise<CharterDTOs.DoctorOutcome | FaultDTOs.Fault>;
  /** What each agent this repository compiles for is sent of the charter when
   *  a session opens, estimated by a tokenizer on this machine (EVAL-FR-001,
   *  EVAL-FR-002). Reads and says (FR-041). */
  predictMainContext(): Promise<CharterDTOs.MainContexts | FaultDTOs.FaultsByFile | FaultDTOs.Fault>;
  /**
   * One reading of the charter, put on disk (FR-020, FR-021): a charter with
   * an error is refused before anything is touched, with its errors given back
   * (FR-005, FR-009); an mcp origin that cannot be asked for its tools stops it
   * as an error does (EVAL-FR-031).
   */
  build(): Promise<CharterDTOs.PlanSummary | FaultDTOs.FaultsByFile | FaultDTOs.Fault>;
  /** The build, worked out and stopped short of disk (FR-022). */
  preview(): Promise<CharterDTOs.PlanSummary | FaultDTOs.FaultsByFile | FaultDTOs.Fault>;
  /** Every tool the mcp origins the last build listed serve, read off what it
   *  kept there: no mcp origin is reached to list them (EVAL-FR-031). */
  tools(): Promise<CharterDTOs.ServedTools | FaultDTOs.Fault>;
  /** Every tool the mcp origins the last build listed declare, under the name
   *  it is served by, with the mcp origin a call to it is forwarded to
   *  (FR-152 – FR-154). */
  declaredTools(): Promise<CharterDTOs.DeclaredTools | FaultDTOs.Fault>;
  /** The commands the last build laid for this signal of this agent
   *  (CORE-FR-176). */
  sensorCommands(signal: string, agent: AgentProviderName): Promise<CharterDTOs.SensorCommands | FaultDTOs.Fault>;
  /** The charter of the checkout `checkoutPath` names, built into it for the
   *  agents this was composed with, keeping the tools the last build kept
   *  (EVAL-FR-021). */
  buildInto(checkoutPath: string): Promise<CharterDTOs.PlanSummary | FaultDTOs.FaultsByFile | FaultDTOs.Fault>;
  /** What each agent this repository compiles for is sent of the charter when
   *  a session opens, each text as the build lays it, for an exact count
   *  (EVAL-FR-004). */
  mainContextTexts(): Promise<CharterDTOs.MainContextTexts | FaultDTOs.FaultsByFile | FaultDTOs.Fault>;
  /** Every evaluation case of the checkout `checkoutPath` names, checked
   *  against its charter: a charter with an error, a file that does not read,
   *  or a case naming a skill or a guide the charter does not hold, is answered
   *  as faults under their files (EVAL-FR-026). */
  evalCases(checkoutPath: string): Promise<CharterDTOs.EvalCases | FaultDTOs.FaultsByFile | FaultDTOs.Fault>;
}

/**
 * DRIVEN PORT — a tokenizer that runs on this machine. The hexagon hands it a
 * text and is told how many tokens that text is; which tokenizer answers, and
 * how, is the adapter's business.
 *
 * No tokenizer of the model an agent runs on is at hand offline, so what this
 * answers is an estimate of that model's count, and whoever says the number
 * says so (EVAL-FR-002).
 */
interface ForCountingTokens {
  /** How many tokens this text is, to the tokenizer behind this port. */
  countTokens(text: string): number;
}

/** What one primitive's author answered, under the header each answer fills
 *  in: a line, or the entries of a list — not yet read by the kind's schema,
 *  which is what refuses what the kind will not take. */
type UnparsedHeaders = Readonly<Record<string, string | readonly string[]>>;

/** One mcp origin a token is asked for: the address its credential is kept
 *  under, its endpoint where it has one, and the id of an mcp at it, which
 *  `cw mcp auth` signs in by. */
interface McpOriginAddress {
  readonly address: string;
  readonly endpoint?: string;
  readonly mcpId: string;
}

/** What an mcp origin's authorization server registered `cw` as, and which
 *  server that was: a registration is presented to the server it came from
 *  and no other. */
declare class McpClientRegistration {
  readonly clientId: string;
  readonly clientSecret?: string;
  readonly issuer: string;
  constructor({
    clientId,
    clientSecret,
    issuer,
  }: Pick<McpClientRegistration, "clientId" | "issuer"> & Partial<Pick<McpClientRegistration, "clientSecret">>);
}

/**
 * One developer's sign-in at one address, as the credential store keeps it.
 *
 * No DTO holds it, so no driver can show one (SC-036): it is read, and handed
 * on as the access token a call is made with.
 */
declare class McpCredential {
  readonly address: string;
  readonly method: "oauth" | "token";
  readonly accessToken: string;
  readonly refreshToken?: string;
  readonly expiresAt?: string;
  readonly client?: McpClientRegistration;
  constructor({
    address,
    method,
    accessToken,
    refreshToken,
    expiresAt,
    client,
  }: Pick<McpCredential, "address" | "method" | "accessToken"> &
    Partial<Pick<McpCredential, "refreshToken" | "expiresAt" | "client">>);
}

/**
 * What one OAuth sign-in ends with: the tokens an mcp origin issued, and what it
 * registered `cw` as, so a renewal needs no second registration (plan §19.5).
 *
 * Not a domain type, and no DTO carries one (SC-036): it goes from this port
 * into the credential store and back, and nowhere else.
 */
interface OAuthGrant {
  readonly accessToken: string;
  readonly refreshToken?: string;
  /** ISO 8601. Absent where the mcp origin said nothing of when it expires. */
  readonly expiresAt?: string;
  /** What the mcp origin's authorization server registered `cw` as, and which
   *  server that was: a registration is presented to the server it came from
   *  and no other. */
  readonly client: McpClientRegistration;
}

/** The name of an agent a charter is compiled for, as a file, a DTO or a
 *  command line writes it: whichever names the projections the engine was
 *  composed with answer to, never a list of its own (CORE-FR-221). */
type AgentProviderName = string;
