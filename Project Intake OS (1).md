# **Project Proposal: Internal Project Intake, Evaluation, Approval, and Distribution System**

## **Working Name**

**Digital Solutions Project Intake OS**

Alternative names:

* Project Approval and Distribution Gateway  
* Digital Solutions Intake Control Plane  
* Project Evaluation and Handoff System  
* Internal Delivery Intake OS  
  ---

  # **Executive Summary**

The Digital Solutions team needs a reliable internal system for turning discovery outputs and project requests into structured, approved, and distributable project work. Current requests may originate from management, DevOps, discovery calls, forwarded notes, or internal discussions. These requests often involve n8n automations, data syncs, internal tools, client-facing web applications, dashboards, and SaaS-style builds.

The proposed system is a **custom in-house monolith** that functions as a pre-distribution control plane. It will capture project requests, use AI to generate structured evaluations and handoff packets, route the work through two human approval gates, and then distribute approved work to Monday and GitHub.

The system will not attempt to replace Monday or GitHub. Instead, Monday and GitHub will act as downstream distribution networks:

* **Monday** will support operational visibility, project assignment, and high-level delivery tracking.  
* **GitHub** will support engineering execution, repositories, issues, and code-level collaboration.  
* **The custom app** will own intake, evaluation, approval, packaging, distribution history, and auditability.

The core principle is:

The app owns the boundary. Monday and GitHub distribute the work. Developers own implementation.

This prevents process chaos without forcing every developer into a rigid workflow.

---

# **1\. Problem Framing**

## **1.1 Business Context**

The Digital Solutions department handles a wide range of technical requests, including:

* n8n workflow automations  
* Manual process automation  
* Data transfers between platforms  
* API integrations  
* Internal web applications  
* Client-facing portals  
* SaaS-style tools  
* Dashboards and reporting systems  
* AI-assisted workflow tools

These projects commonly begin as loosely structured ideas or discovery notes. Before they can be assigned to developers, they need to be evaluated, scoped, approved, and converted into a clear handoff package.

The current gap is not merely intake. The real gap is the transition from:

messy request or discovery output

into:

approved, structured, dev-ready work package

Without a consistent intake and approval boundary, the team risks:

* unclear project ownership  
* incomplete requirements  
* premature task creation  
* duplicated GitHub repositories or Monday items  
* weak handoffs to developers  
* unnecessary back-and-forth  
* inconsistent budget and tooling decisions  
* overuse or misuse of AI resources  
* loss of context from discovery calls

The goal is to establish a controlled internal system for preparing and distributing work without standardizing how each developer executes that work.

---

## **1.2 Core Concept**

The proposed system is an **internal pre-distribution control plane**.

It will perform five primary functions:

1. Capture project requests and discovery outputs.  
2. Use AI to generate structured project evaluations.  
3. Route evaluations through two approval gates.  
4. Package approved work into a distribution-ready format.  
5. Create Monday tasks and GitHub repositories/issues when appropriate.

The system should not become a full replacement for Monday, GitHub, or developer workflows. Instead, it should act as the gate before work enters those environments.

---

## **1.3 Guiding Principle**

The system standardizes **boundaries**, not workflows.

It standardizes:

* what must be known before work starts  
* what must be evaluated before approval  
* who approves the work  
* what gets created after approval  
* what information must be handed off  
* where approved work is distributed

It does not standardize:

* how each developer executes the task  
* the exact order of implementation  
* the developer’s preferred workflow  
* every technical decision made during development  
* long-term status tracking after distribution

Developer autonomy should remain intact.

---

## **1.4 Success Matrix**

| Category | Success Criteria |
| ----- | ----- |
| Intake Quality | Requests consistently capture problem, goal, requester, discovery notes, systems involved, and desired outcome. |
| Evaluation Quality | AI produces useful architecture proposals, tool recommendations, implementation options, risks, estimates, and work breakdowns. |
| Governance | No Monday task, GitHub repository, or developer assignment is created before required approvals are complete. |
| Approval Control | Both intake owner and DevOps lead can review, approve, reject, or request clarification. |
| Distribution Quality | Approved work is distributed cleanly to Monday and GitHub with appropriate detail and links. |
| Developer Autonomy | Developers receive clear handoff packages but remain free to adjust technical implementation as needed. |
| Cost Control | AI usage is tiered, logged, and bounded to evaluation and handoff generation. |
| Traceability | The app records what was requested, evaluated, approved, and distributed. |
| Simplicity | The system avoids unnecessary bidirectional sync after handoff. |

---

## **1.5 Constraints**

The current design constraints are:

* The system should be custom and in-house.  
* A monolith is preferred if possible.  
* The first version should be internal-only.  
* Intake is primarily for management and DevOps after discovery.  
* Monday and GitHub are distribution networks, not the core system.  
* AI should generate evaluations, options, architecture, and work packages.  
* AI should not independently approve projects.  
* AI should not continuously manage downstream execution.  
* Two approvals are required before distribution.  
* Automatic provisioning is preferred once validation and approvals pass.  
* The system should avoid heavy post-handoff synchronization.  
* The system should support both low/no-code and custom-build recommendations.  
  ---

  # **2\. Requirement Gathering**

  ## **2.1 Functional Requirements**

  ## **2.1.1 Intake Management**

The system must allow authorized internal users to create project requests based on discovery calls, stakeholder conversations, or management direction.

The intake form should capture:

* requester or client  
* internal owner  
* business problem  
* desired goal  
* current process  
* discovery notes  
* systems involved  
* source systems  
* destination systems  
* data involved  
* known constraints  
* deadline or urgency  
* budget expectations, if known  
* preferred implementation direction, if any  
* attachments or reference materials

The system should generate a unique request ID for every intake.

Example:

```
REQ-000123
```

---

## **2.1.2 AI Evaluation**

After intake submission, the system should generate a structured project evaluation.

The evaluation should include:

* project title  
* project type  
* executive summary  
* problem interpretation  
* goal interpretation  
* proposed architecture  
* recommended tools  
* custom-build option  
* no-code/low-code option  
* recommended option  
* estimated effort  
* complexity level  
* confidence level  
* risks  
* assumptions  
* open questions  
* access requirements  
* budget or AI cost considerations  
* suggested epics  
* suggested user stories  
* suggested story points  
* acceptance criteria  
* handoff notes

The AI output should be stored as a draft until reviewed and approved.

---

## **2.1.3 Evaluation Depth Levels**

Not every request requires the same level of evaluation. The system should support multiple evaluation depths.

### **Light Evaluation**

Used for:

* simple n8n workflows  
* basic data transfers  
* simple reporting requests  
* minor workflow automations

Includes:

* problem  
* goal  
* systems involved  
* recommended implementation path  
* risks  
* assumptions  
* basic task breakdown

  ### **Standard Evaluation**

Used for:

* complex n8n workflows  
* multi-system integrations  
* internal tools  
* dashboards  
* moderate automation projects

Includes:

* architecture sketch  
* implementation options  
* tool recommendations  
* dependencies  
* acceptance criteria  
* epics/stories  
* effort estimate

  ### **Full Evaluation**

Used for:

* client-facing web applications  
* SaaS-style systems  
* high-risk workflows  
* systems with sensitive data  
* custom applications requiring infrastructure

Includes:

* proposed architecture  
* system components  
* data model considerations  
* security concerns  
* reliability concerns  
* deployment notes  
* trade-off analysis  
* cost engineering  
* detailed epics and GitHub issue drafts  
  ---

  ## **2.1.4 Clarification Flow**

If an intake is incomplete or ambiguous, the system should generate clarification questions.

Examples:

* Which system is the source of truth?  
* What should trigger the workflow?  
* What fields need to be transferred?  
* Who approves the output?  
* What is the expected volume?  
* Are there security or compliance concerns?  
* Is there a hard deadline?

The request should not move forward until the necessary clarification is provided or a manager overrides the requirement.

---

## **2.1.5 Dual Approval Workflow**

The system must support two approval gates.

### **Approval Gate 1: Intake / Concept Approval**

Owner: Intake owner / project lead

Purpose:

* validate that the request is real and worth moving forward  
* confirm that the AI evaluation is directionally correct  
* decide whether more clarification is needed  
* decide whether the request should move to DevOps review

Possible decisions:

* approve for DevOps review  
* request clarification  
* reject  
* hold  
* convert to discovery

  ### **Approval Gate 2: DevOps / Execution Approval**

Owner: DevOps lead

Purpose:

* validate project type  
* validate effort and budget expectations  
* confirm tooling and resource feasibility  
* confirm whether GitHub is required  
* confirm whether Monday should receive epics only or epics plus stories  
* approve the final distribution package

Possible decisions:

* approve for distribution  
* request changes  
* request more discovery  
* reject  
* hold

Only after both approvals are completed should the system distribute work to Monday and GitHub.

---

## **2.1.6 Distribution Rules**

After approval, the system should distribute the project according to project type.

### **Monday Distribution**

Monday should receive operational work packages.

Two supported modes:

#### **Mode B: Project \+ Epics**

Best for projects where GitHub will handle engineering detail.

Used for:

* web apps  
* internal tools  
* client-facing apps  
* SaaS-style systems  
* custom code projects

Monday receives:

* project title  
* summary  
* priority  
* DevOps lead  
* epics  
* source link or distribution record  
* GitHub repo link, if created

  #### **Mode C: Project \+ Epics \+ Stories/Subtasks**

Best for projects where Monday is the primary execution surface.

Used for:

* n8n automations  
* simple data syncs  
* no-code/low-code work  
* operational automation projects without GitHub

Monday receives:

* project title  
* summary  
* epics  
* user stories or subtasks  
* acceptance criteria  
* dependencies  
* risks  
* source link or distribution record

Recommended rule:

```
If GitHub exists, Monday receives Mode B.
If GitHub does not exist, Monday receives Mode C.
```

---

### **GitHub Distribution**

GitHub should receive engineering-specific execution artifacts.

GitHub should be created for:

* web applications  
* internal tools  
* SaaS-style systems  
* custom APIs  
* custom backend/frontend projects  
* complex automations requiring custom code

GitHub should not be created for:

* simple n8n workflows  
* discovery-only requests  
* basic no-code tasks  
* simple data transfers with no custom code

GitHub receives:

* repository  
* README  
* project brief  
* labels  
* milestones, if needed  
* engineering-specific issues  
* links back to the approved distribution record

GitHub issues should not simply mirror internal stories one-to-one. They should be generated as engineering-specific issues linked to internal epics/stories.

---

## **2.1.7 Provisioning**

Provisioning should run automatically after both approval gates are complete and validation passes.

Automatic provisioning requirements:

* approval 1 is complete  
* approval 2 is complete  
* project type is valid  
* distribution package is valid  
* required fields are present  
* no blocking flags exist  
* target systems are available  
* repo name does not collide  
* Monday board configuration is available

Provisioning should create:

* Monday project item  
* Monday epics or subitems  
* GitHub repository, if required  
* GitHub issues, if required  
* initial documentation, if required  
* distribution record  
* DevOps notification

Provisioning should stop or require manual review if:

* AI confidence is low  
* data is sensitive  
* budget is unclear  
* project type is unclear  
* external client access is required  
* required credentials are missing  
* GitHub repository name collides  
* Monday or GitHub API fails  
  ---

  ## **2.1.8 DevOps Handoff**

After distribution, DevOps should receive a complete handoff package.

The handoff should include:

* request ID  
* project title  
* project type  
* approved problem  
* approved goal  
* selected implementation option  
* proposed architecture  
* tool recommendations  
* risks  
* assumptions  
* dependencies  
* acceptance criteria  
* Monday link  
* GitHub link, if applicable  
* assignment notes

The handoff should include a developer autonomy note:

This is a recommended implementation direction based on the approved intake and evaluation. The assigned developer may adjust technical execution as needed while preserving the approved goal, scope, constraints, and acceptance criteria.

---

## **2.2 Non-Functional Requirements**

## **2.2.1 Performance**

The system does not require extreme low-latency performance. Most heavy operations should run asynchronously.

Targets:

* dashboard page load under 2 seconds for normal usage  
* request detail page load under 2 seconds  
* AI evaluation handled asynchronously  
* provisioning handled asynchronously  
* no long-running external API call should block the user interface  
  ---

  ## **2.2.2 Scale**

Initial scale is expected to be moderate:

* small internal user base  
* dozens to hundreds of project requests  
* limited number of managers and DevOps users  
* moderate GitHub and Monday provisioning volume

The system should eventually support:

* thousands of intake records  
* thousands of evaluation versions  
* many external distribution records  
* many GitHub issues and Monday links  
  ---

  ## **2.2.3 Reliability**

The system must reliably preserve:

* request records  
* evaluation versions  
* approval records  
* distribution decisions  
* provisioning logs  
* external resource links

Provisioning should be idempotent and retryable.

If GitHub or Monday provisioning partially fails, the system should show a partial success state and allow retrying failed steps.

---

## **2.2.4 Security**

The system will contain internal project details and potentially client information.

Security requirements:

* internal-only access  
* authenticated users only  
* role-based permissions  
* secure storage of API credentials  
* audit logs for approvals and provisioning  
* least-privilege API tokens  
* no secrets in logs  
* clear separation of requester, reviewer, DevOps, developer, and admin permissions  
  ---

  ## **2.2.5 Maintainability**

The system should be built as a modular monolith.

Suggested modules:

* intake  
* evaluation  
* approval  
* projects  
* distribution  
* integrations  
* audit  
* admin  
* AI services

This allows the system to remain simple while keeping the codebase organized.

---

## **2.2.6 Compliance**

Baseline compliance considerations:

* approval history must be retained  
* project decisions must be auditable  
* sensitive projects should be flaggable  
* access to project data should be role-based  
* AI-generated content should be reviewable and versioned  
* distribution records should show who approved what and when  
  ---

  # **3\. High-Level System Design**

  ## **3.1 System Overview**

```
Management / DevOps Discovery
        ↓
Custom Internal App
        ↓
Project Intake
        ↓
AI Evaluation
        ↓
Approval Gate 1
        ↓
Approval Gate 2
        ↓
Distribution Package
        ↓
Monday / GitHub Provisioning
        ↓
DevOps Assignment
        ↓
Developer Execution
```

  ---

  ## **3.2 System Roles**

  ### **Custom App**

Owns:

* intake  
* evaluation  
* approval  
* distribution package  
* provisioning record  
* audit history

Does not own:

* long-term execution status  
* every Monday update  
* every GitHub issue update  
* developer implementation flow

  ### **Monday**

Owns:

* operational assignment  
* high-level project visibility  
* epics or subtasks depending on project type  
* DevOps delivery tracking

  ### **GitHub**

Owns:

* repository  
* engineering issues  
* pull requests  
* technical execution discussions  
* implementation artifacts

  ### **DevOps**

Owns:

* final execution approval  
* assignment to developer  
* operational routing after distribution

  ### **Developer**

Owns:

* implementation decisions  
* technical execution  
* code-level delivery  
* adjustments to the recommended approach when appropriate  
  ---

  # **4\. Core System Design Components**

  ## **4.1 Client Layer**

The client layer should be a web application for internal users.

Primary screens:

1. Login / authentication  
2. Request dashboard  
3. Intake form  
4. Request detail page  
5. AI evaluation page  
6. Clarification page  
7. Approval review page  
8. Distribution preview page  
9. Provisioning status page  
10. Project handoff page  
11. Admin settings

The UI should focus on clarity and decision-making rather than task execution.

---

## **4.2 API Layer**

The API should support:

* request creation  
* request updates  
* evaluation generation  
* evaluation regeneration  
* clarification handling  
* approval actions  
* distribution preview  
* provisioning execution  
* provisioning retry  
* audit retrieval  
* integration configuration

Example routes:

```
POST /api/requests
GET /api/requests/:id
POST /api/requests/:id/evaluate
POST /api/evaluations/:id/regenerate
POST /api/requests/:id/approve-intake
POST /api/requests/:id/approve-devops
POST /api/projects/:id/distribution-preview
POST /api/projects/:id/provision
POST /api/provisioning-jobs/:id/retry
```

---

## **4.3 Service Architecture**

The system should be built as a modular monolith.

Recommended structure:

```
/app
  /modules
    /intake
    /evaluation
    /approval
    /projects
    /distribution
    /integrations
      /monday
      /github
    /ai
    /audit
    /admin
```

The monolith should directly own the core database and workflow state.

A separate worker process can be used for asynchronous jobs while sharing the same codebase.

Runtime shape:

```
Web app process
Worker process
Postgres database
Redis / queue
Object storage
```

---

## **4.4 Data Layer**

## **4.4.1 Database Choice**

Recommended database:

```
Postgres
```

Reasons:

* strong relational modeling  
* reliable workflow state storage  
* support for JSONB AI packets  
* good indexing capabilities  
* strong consistency  
* mature ecosystem  
  ---

  ## **4.4.2 Core Data Model**

  ### **users**

Stores internal users.

Fields:

* id  
* name  
* email  
* role  
* team  
* created\_at  
* updated\_at

  ### **requests**

Stores raw project requests.

Fields:

* id  
* request\_number  
* requester\_name  
* requester\_email  
* source  
* problem  
* goal  
* current\_process  
* discovery\_notes  
* systems\_involved  
* data\_involved  
* urgency  
* budget\_expectation  
* status  
* created\_by  
* created\_at  
* updated\_at

  ### **evaluations**

Stores AI-generated evaluations.

Fields:

* id  
* request\_id  
* version  
* evaluation\_depth  
* project\_type  
* summary  
* proposed\_architecture  
* recommended\_tools  
* recommended\_option  
* complexity  
* confidence  
* estimated\_effort  
* evaluation\_json  
* ai\_model  
* ai\_cost\_estimate  
* created\_at

  ### **implementation\_options**

Stores custom and low/no-code options.

Fields:

* id  
* evaluation\_id  
* option\_type  
* title  
* description  
* pros  
* cons  
* estimated\_effort  
* recommended\_when  
* sort\_order

  ### **approvals**

Stores approval decisions.

Fields:

* id  
* request\_id  
* evaluation\_id  
* approval\_stage  
* decision  
* approver\_id  
* notes  
* approved\_at

  ### **projects**

Created after approvals.

Fields:

* id  
* request\_id  
* project\_number  
* title  
* project\_type  
* selected\_option  
* distribution\_mode  
* status  
* devops\_owner\_id  
* created\_at  
* updated\_at

  ### **epics**

Stores approved epics.

Fields:

* id  
* project\_id  
* title  
* description  
* sort\_order

  ### **stories**

Stores approved stories or work units.

Fields:

* id  
* epic\_id  
* title  
* description  
* acceptance\_criteria  
* story\_points  
* dependencies  
* sort\_order

  ### **provisioning\_jobs**

Stores provisioning attempts.

Fields:

* id  
* project\_id  
* job\_type  
* status  
* payload  
* result  
* error  
* attempt\_count  
* created\_at  
* updated\_at

  ### **integration\_resources**

Stores external links and IDs.

Fields:

* id  
* project\_id  
* system  
* resource\_type  
* external\_id  
* url  
* metadata  
* created\_at

  ### **audit\_logs**

Stores important system events.

Fields:

* id  
* actor\_id  
* entity\_type  
* entity\_id  
* action  
* before  
* after  
* created\_at  
  ---

  ## **4.4.3 Consistency Model**

Postgres is the internal source for pre-distribution records.

External tools are not treated as authoritative for approval history.

Once distribution is complete, the custom app does not need to continuously mirror Monday or GitHub changes.

The app should store:

* what was approved  
* who approved it  
* when it was approved  
* what was distributed  
* where it was distributed  
* whether provisioning succeeded or failed  
  ---

  ## **4.4.4 Query Planning**

Important indexes:

* requests.status  
* requests.created\_at  
* evaluations.request\_id  
* evaluations.project\_type  
* approvals.request\_id  
* approvals.approval\_stage  
* projects.status  
* projects.project\_type  
* provisioning\_jobs.status  
* integration\_resources.project\_id  
* audit\_logs.entity\_type \+ entity\_id

Common queries:

* requests awaiting intake approval  
* requests awaiting DevOps approval  
* failed provisioning jobs  
* distributed projects  
* requests by requester/client  
* projects by type  
* projects by distribution mode  
  ---

  ## **4.5 Messaging and Async**

Asynchronous jobs should be used for:

* AI evaluation generation  
* AI regeneration  
* clarification question generation  
* distribution preview generation  
* Monday provisioning  
* GitHub provisioning  
* notification sending  
* provisioning retries

Recommended MVP approach:

```
BullMQ + Redis
```

Alternative cloud-native options:

* AWS SQS  
* Google Cloud Tasks  
* Cloud Pub/Sub

For the initial monolith, BullMQ and Redis are likely sufficient.

---

## **4.6 Caching**

Caching is not critical for the first version.

Potential future cache targets:

* Monday board metadata  
* GitHub label templates  
* dashboard counts  
* user session data  
* integration configuration

Start without complex caching and add it only where needed.

---

# **5\. Scalability**

## **5.1 Traffic Expectations**

The app is internal-only and should initially support moderate usage.

Expected initial traffic:

* several internal users  
* management and DevOps users  
* occasional AI evaluation jobs  
* occasional provisioning jobs

Traffic spikes may occur after discovery-heavy periods or when multiple requests are submitted.

---

## **5.2 Capacity Considerations**

Primary capacity concerns:

* AI token usage  
* AI response size  
* attachment storage  
* Monday API rate limits  
* GitHub API rate limits  
* provisioning retries  
* evaluation version history

Mitigations:

* queue AI and provisioning jobs  
* store attachments in object storage  
* log token usage  
* validate AI response size  
* rate-limit provisioning jobs  
* retain only necessary post-distribution state  
  ---

  ## **5.3 Scale Pattern**

Recommended scaling pattern:

```
Start as a monolith.
Run web and worker as separate processes.
Scale worker separately if AI/provisioning load increases.
Keep shared Postgres and Redis.
```

This keeps the architecture simple while allowing background jobs to scale independently.

---

# **6\. Reliability**

## **6.1 Failure Mode Analysis**

| Failure Mode | Impact | Mitigation |
| ----- | ----- | ----- |
| AI returns invalid JSON | Evaluation cannot be stored cleanly | Schema validation, retry, fallback manual editing |
| AI generates weak evaluation | Bad handoff quality | Human review, confidence scoring, assumptions/open questions |
| Intake is incomplete | Project cannot be evaluated | Clarification flow |
| Approval is skipped | Unapproved work enters tools | Enforced state machine |
| Monday API fails | Operational task not created | Retryable provisioning job |
| GitHub API fails | Repo/issues not created | Retryable provisioning job |
| Partial provisioning | Some resources exist, others do not | Partial success state, per-step retry |
| Duplicate repo/task creation | Clutter and confusion | Idempotency keys, stored external IDs, name collision checks |
| Secrets exposed in logs | Security risk | Secret manager, log redaction |
| App outage | Intake/review unavailable | Backups, deploy rollback, queue durability |

---

## **6.2 Disaster Recovery**

Minimum disaster recovery plan:

* automated database backups  
* object storage backup or retention policy  
* environment variable and secret backup procedure  
* deployment rollback process  
* failed job retry procedure

Recommended maturity target:

* point-in-time recovery for Postgres  
* tested restore process  
* dead-letter queue for failed jobs  
* documented incident response runbook  
  ---

  # **7\. Observability**

The system should track:

* requests submitted  
* evaluations generated  
* evaluation failures  
* clarification loops  
* approval time  
* rejection rate  
* distribution success rate  
* provisioning failures  
* AI cost per request  
* model usage  
* Monday API errors  
* GitHub API errors

Minimum admin dashboard metrics:

* pending intake approvals  
* pending DevOps approvals  
* failed provisioning jobs  
* projects distributed this month  
* AI usage estimate  
* average time from intake to distribution

Logs should include:

* request\_id  
* project\_id  
* provisioning\_job\_id  
* user\_id  
* external system  
* action  
* error details when applicable  
  ---

  # **8\. Security Design**

  ## **8.1 Authentication**

The app should use internal authentication.

Preferred:

* Google Workspace SSO

Alternative:

* app-managed authentication for MVP  
  ---

  ## **8.2 Authorization**

Suggested roles:

### **Request Creator**

Can:

* create requests  
* view requests they created  
* respond to clarification questions

  ### **Intake Owner**

Can:

* view requests  
* review AI evaluations  
* approve gate 1  
* request clarification  
* reject or hold requests

  ### **DevOps Lead**

Can:

* approve gate 2  
* review distribution package  
* confirm project type  
* confirm budget/type/resources  
* assign work after distribution

  ### **Developer**

Can:

* view distributed handoff pages if assigned or permitted  
* access GitHub/Monday resources according to downstream permissions

  ### **Admin**

Can:

* manage users  
* manage integration settings  
* manage project type rules  
* manage AI model settings  
* view audit logs  
  ---

  ## **8.3 Secret Management**

API tokens and integration credentials should be stored in a secret manager.

Options:

* AWS Secrets Manager  
* GCP Secret Manager  
* managed hosting secret storage

Secrets must not be stored directly in normal database fields.

---

## **8.4 API Permissions**

The app should have limited write permissions.

For Monday:

Allowed:

* create items  
* create subitems  
* set initial fields  
* add source links

Avoid:

* overwriting downstream edits after distribution  
* continuous sync of all Monday fields

For GitHub:

Allowed:

* create repository  
* create labels  
* create initial README/docs  
* create issues  
* link back to distribution record

Avoid:

* editing developer-created issues after handoff  
* modifying code after handoff  
* closing issues automatically  
* managing pull requests  
  ---

  ## **8.5 Audit Logging**

Audit logs should capture:

* request creation  
* request edits  
* AI evaluation generation  
* evaluation regeneration  
* approval decisions  
* approval comments  
* distribution package generation  
* provisioning start  
* provisioning success/failure  
* external resources created  
* admin setting changes  
  ---

  # **9\. Infrastructure and Deployment**

  ## **9.1 Cloud**

The system can be hosted on AWS or GCP.

Potential AWS setup:

* ECS or App Runner  
* RDS Postgres  
* ElastiCache Redis  
* S3 for attachments  
* Secrets Manager  
* CloudWatch

Potential GCP setup:

* Cloud Run  
* Cloud SQL Postgres  
* Memorystore Redis  
* Cloud Storage  
* Secret Manager  
* Cloud Logging

For ease of operation, a simple managed deployment platform could also be considered during prototyping.

---

## **9.2 Infrastructure as Code**

Initial prototype may be configured manually.

For production, infrastructure should be managed with:

* Terraform  
* Pulumi  
* AWS CDK

Recommended: Terraform or Pulumi once the deployment shape stabilizes.

---

## **9.3 Containerization**

The application should be containerized.

Recommended containers:

* web app container  
* worker container

Same codebase, different runtime commands.

Example:

```
web: start web server
worker: process AI/provisioning jobs
```

---

## **9.4 CI/CD**

Pipeline should include:

* lint  
* typecheck  
* unit tests  
* build  
* database migration check  
* deploy to staging  
* deploy to production

Recommended environments:

* development  
* staging  
* production

Production Monday/GitHub provisioning should only be enabled after staging tests are successful.

---

# **10\. Cost Engineering**

## **10.1 Cost Drivers**

Main cost drivers:

* AI model usage  
* hosting  
* database  
* Redis/queue  
* object storage  
* logging  
* external API calls

AI will likely be the most variable cost.

---

## **10.2 AI Cost Strategy**

Use a tiered AI strategy.

### **Lower-cost model**

Used for:

* summarization  
* classification  
* missing information detection  
* clarification question drafting

  ### **Stronger model**

Used for:

* proposed architecture  
* implementation options  
* trade-off analysis  
* epics and story generation  
* GitHub issue drafting  
* full evaluation packets

  ### **No AI**

Used for:

* approval state changes  
* provisioning execution  
* API calls  
* permission checks  
* audit logs  
* notifications  
  ---

  ## **10.3 Cost Controls**

The app should track:

* model used  
* tokens used  
* cost estimate per evaluation  
* number of regenerations  
* total monthly usage

Cost-saving rules:

* do not regenerate full evaluations unnecessarily  
* allow manual edits instead of regeneration  
* use evaluation depth levels  
* use cheaper models for simple requests  
* reserve premium models for complex/high-risk projects  
  ---

  # **11\. Trade-Off Analysis**

  ## **11.1 Monolith vs Microservices**

Recommendation: **Monolith**

Reason:

* simpler to build  
* easier to maintain  
* easier to reason about approval state  
* faster to iterate  
* appropriate for internal workflow software

Trade-off:

* less independent scaling, but acceptable at expected scale  
  ---

  ## **11.2 Custom App vs Monday as Core**

Recommendation: **Custom app as pre-distribution control plane**

Reason:

* Monday is not ideal for AI evaluation, approval governance, or decision packet versioning  
* custom app gives better control over boundaries  
* Monday can still receive clean operational packages

Trade-off:

* more upfront build effort  
  ---

  ## **11.3 Full Source of Truth vs Pre-Distribution Source of Truth**

Recommendation: **Pre-distribution source of truth**

Reason:

* avoids sync complexity  
* lets Monday and GitHub own execution after handoff  
* keeps the custom app focused  
* reduces duplicated state

Trade-off:

* custom app will not show every downstream execution detail  
  ---

  ## **11.4 Direct API Integration vs n8n Integration**

Recommendation: **Direct API integration for core provisioning**

Reason:

* app should own provisioning state  
* easier to enforce idempotency  
* easier to audit  
* fewer moving parts for critical actions

n8n can still be used for supporting workflows where appropriate.

Trade-off:

* more custom code  
  ---

  ## **11.5 Automatic Provisioning vs Manual Provision Button**

Recommendation: **Automatic provisioning after both approvals and validation**

Reason:

* reduces admin overhead  
* aligns with desired operating model  
* keeps the process moving

Safeguard:

* stop automatic provisioning when risk flags exist  
* provide manual review for exceptions

Trade-off:

* requires strong validation and idempotency controls  
  ---

  ## **11.6 Monday Mode B vs Mode C**

Recommendation:

```
If GitHub exists: Monday Mode B, project + epics.
If GitHub does not exist: Monday Mode C, project + epics + stories/subtasks.
```

Reason:

* avoids duplicating granular engineering issues in both Monday and GitHub  
* keeps Monday useful for visibility  
* keeps GitHub useful for engineering execution

Trade-off:

* Monday may have less detail for GitHub-based projects  
  ---

  # **12\. Expected Documentation**

The project should produce the following documentation.

## **12.1 Product Documentation**

* Product Requirements Document  
* User roles and permissions guide  
* Intake field guide  
* Approval workflow guide  
* Evaluation packet guide  
* DevOps handoff guide

  ## **12.2 Technical Documentation**

* System architecture document  
* Data model / ERD  
* API specification  
* AI evaluation schema  
* Distribution package schema  
* Monday integration spec  
* GitHub integration spec  
* Provisioning rules spec  
* Error handling and retry spec

  ## **12.3 Operational Documentation**

* Admin guide  
* Deployment runbook  
* Incident response runbook  
* Disaster recovery runbook  
* Secret rotation procedure  
* AI cost monitoring guide  
  ---

  # **13\. Proposed MVP**

  ## **13.1 MVP Goal**

The MVP should prove that the system can turn internal discovery notes into an AI-generated evaluation, route the project through two approvals, and produce a distribution-ready package.

The MVP does not need to fully automate every downstream behavior immediately.

---

## **13.2 MVP Features**

MVP should include:

1. Internal authentication  
2. Request dashboard  
3. Intake form  
4. Request detail page  
5. AI evaluation generation  
6. Evaluation depth selection  
7. Clarification questions  
8. Approval Gate 1  
9. Approval Gate 2  
10. Distribution package generation  
11. Provisioning preview  
12. Basic audit log  
13. Manual or semi-automatic distribution record  
    ---

    ## **13.3 MVP Exclusions**

MVP should not include initially:

* client-facing portal  
* deep Monday/GitHub sync  
* automatic developer assignment  
* complex reporting dashboard  
* full infrastructure automation  
* advanced budget forecasting  
* full bidirectional issue tracking  
  ---

  # **14\. Phase Plan**

  ## **Phase 1: Concept and Schema Finalization**

Deliverables:

* project type list  
* intake schema  
* evaluation schema  
* approval state machine  
* distribution rules  
* Monday distribution modes  
* GitHub distribution rules  
* ready-for-distribution checklist

Outcome:

* system boundaries are finalized  
  ---

  ## **Phase 2: Monolith MVP**

Deliverables:

* internal app shell  
* authentication  
* intake form  
* request dashboard  
* request detail page  
* AI evaluation generation  
* evaluation display  
* approval gate 1  
* approval gate 2  
* audit log basics

Outcome:

* intake to approval loop works  
  ---

  ## **Phase 3: Distribution Package and Preview**

Deliverables:

* approved project creation  
* epics and stories  
* distribution mode selection  
* Monday preview  
* GitHub preview  
* validation rules  
* blocked provisioning states

Outcome:

* approved work can be packaged safely before creation  
  ---

  ## **Phase 4: Monday Distribution**

Deliverables:

* Monday item creation  
* Monday epic/subitem creation  
* external ID storage  
* provisioning logs  
* retry failed Monday actions

Outcome:

* approved projects can be distributed to Monday  
  ---

  ## **Phase 5: GitHub Distribution**

Deliverables:

* GitHub repo creation  
* repo template support  
* README/project brief creation  
* label creation  
* issue creation  
* external ID storage  
* retry failed GitHub actions

Outcome:

* approved code-based projects can be distributed to GitHub  
  ---

  ## **Phase 6: Hardening**

Deliverables:

* role-based access improvements  
* better audit logs  
* AI cost tracking  
* duplicate detection  
* security flags  
* budget flags  
* error dashboards  
* backup/restore process

Outcome:

* system is ready for regular internal use  
  ---

  # **15\. Ready-for-Distribution Checklist**

A project should not be distributed unless it has:

* request ID  
* requester/client  
* approved problem statement  
* approved goal  
* project type  
* evaluation depth  
* selected implementation option  
* proposed architecture or trimmed architecture summary  
* recommended tools  
* acceptance criteria  
* risks and assumptions  
* work breakdown  
* approval gate 1 completed  
* approval gate 2 completed  
* distribution mode selected  
* provisioning targets validated

For GitHub projects, it should also have:

* repo name  
* repo visibility  
* repo description  
* issue list  
* README/project brief draft

For Monday projects, it should also have:

* Monday board target  
* project title  
* epics or subitems  
* DevOps owner  
  ---

  # **16\. Recommended Evaluation Packet Structure**

```
1. Project Summary
2. Problem Statement
3. Goal / Desired Outcome
4. Project Type
5. Evaluation Depth
6. Proposed Architecture
7. Recommended Tools
8. Implementation Options
   - Option A: Custom Build
   - Option B: No-Code / Low-Code
9. Recommended Option
10. Estimated Effort
11. Complexity
12. Confidence
13. Risks
14. Assumptions
15. Open Questions
16. Access Requirements
17. Budget / AI Usage Notes
18. Epics
19. User Stories
20. Acceptance Criteria
21. Distribution Recommendation
22. DevOps Handoff Notes
```

  ---

  # **17\. Proposed System Definition**

The proposed system is:

An internal pre-distribution control plane for Digital Solutions projects that captures discovery outputs, uses AI to generate project evaluations and handoff packages, routes those packages through two approval gates, and distributes approved work to Monday and GitHub.

Short version:

Intake → Evaluation → Dual Approval → Distribution

---

# **18\. Final Recommendation**

The recommended approach is to build a custom in-house monolith focused on project intake, AI-assisted evaluation, approval governance, and downstream distribution.

The system should not attempt to become a full project management replacement. It should instead become the gate before work enters Monday and GitHub.

This keeps the system focused, avoids sync complexity, preserves developer autonomy, and gives management and DevOps a clear approval boundary.

The best first version should prioritize:

1. intake capture  
2. AI-generated evaluation  
3. dual approval  
4. distribution package generation  
5. provisioning preview  
6. Monday/GitHub creation after approval

The final operating principle should remain:

The app decides what is ready. Monday and GitHub distribute it. Developers execute it.

84. 