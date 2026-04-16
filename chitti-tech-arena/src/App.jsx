import { useState, useEffect, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import mqtt from "mqtt";

/* ═══════════════════════════════════════════════════════════════
   CHITTI TECH ARENA — ULTIMATE AI TECH GAME SHOW
   · Cinematic Intro  · Particle Field  · Spinning Wheel
   · Lifelines 50:50 & Ask Audience  · Circular Timer + Sounds
   · Streak Bonuses  · Typing Responses  · Dramatic Reveal
   · Prompt Battle with Live AI Judge  · Animated Podium Finale
   · Floating Reactions  · Confetti  · Score Counter
═══════════════════════════════════════════════════════════════ */

// ── SOUND ENGINE ──────────────────────────────────────────────
const S = {
  _c: null,
  c() { if (!this._c) this._c = new (window.AudioContext || window.webkitAudioContext)(); return this._c; },
  t(f, d, type = "sine", v = 0.22) {
    try {
      const c = this.c(), o = c.createOscillator(), g = c.createGain();
      o.connect(g); g.connect(c.destination); o.type = type;
      o.frequency.setValueAtTime(f, c.currentTime);
      g.gain.setValueAtTime(v, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + d);
      o.start(); o.stop(c.currentTime + d);
    } catch {}
  },
  correct() { [523, 659, 784].forEach((f, i) => setTimeout(() => this.t(f, 0.18), i * 110)); },
  wrong()   { this.t(180, 0.4, "sawtooth", 0.3); },
  tick()    { this.t(900, 0.05, "square", 0.07); },
  fanfare() { [523,659,784,1047,1318].forEach((f,i) => setTimeout(() => this.t(f, 0.2), i*90)); },
  swoosh()  { [700,500,300].forEach((f,i) => setTimeout(() => this.t(f, 0.06, "sine", 0.08), i*35)); },
  spin()    { [300,400,500,600,700,800,900,1000,800,600,400].forEach((f,i) => setTimeout(() => this.t(f, 0.05, "sine", 0.07), i*55)); },
  lifeline(){ [440,550,660,770].forEach((f,i) => setTimeout(() => this.t(f, 0.1), i*90)); },
  buzzer()  { this.t(80, 0.55, "sawtooth", 0.55); setTimeout(() => this.t(60, 0.3, "sawtooth", 0.35), 120); },
  ding()    { [1047,1319,1568].forEach((f,i) => setTimeout(() => this.t(f, 0.12, "sine", 0.18), i*70)); },
};

// ── BACKGROUND MUSIC ENGINE ───────────────────────────────────
const Music = {
  _ctx:null, _master:null, _playing:false, _timer:null,
  ctx(){
    if(!this._ctx){
      this._ctx=new(window.AudioContext||window.webkitAudioContext)();
      this._master=this._ctx.createGain(); this._master.gain.value=0.10;
      this._master.connect(this._ctx.destination);
    }
    return this._ctx;
  },
  _note(freq,start,dur,vol=0.12,type='sine'){
    try{
      const ctx=this.ctx(),o=ctx.createOscillator(),g=ctx.createGain();
      o.connect(g);g.connect(this._master);o.type=type;o.frequency.value=freq;
      g.gain.setValueAtTime(0,start);
      g.gain.linearRampToValueAtTime(vol,start+0.03);
      g.gain.linearRampToValueAtTime(0,start+dur);
      o.start(start);o.stop(start+dur+0.05);
    }catch{}
  },
  _schedule(t){
    const b=0.5; // beat = 0.5s → 120 BPM
    // Bass pulse
    [131,147,165,131,147,131,165,147].forEach((f,i)=>this._note(f,t+i*b,b*0.45,0.15,'sine'));
    // Bright pads (chord stabs)
    [[523,659],[494,622],[440,554],[392,494]].forEach(([a,b2],i)=>{
      this._note(a,t+i*b*2,b*1.8,0.045,'sine');
      this._note(b2,t+i*b*2,b*1.8,0.035,'sine');
    });
    // Hi-hat ticks
    for(let i=0;i<8;i++) this._note(4000,t+i*b,0.04,0.025,'square');
    // Snare accent on beats 2 & 4
    [1,3].forEach(i=>this._note(220,t+i*b*2,0.08,0.06,'sawtooth'));
    return t+8*b; // returns next loop start time
  },
  start(){
    if(this._playing)return;
    this._playing=true;
    const ctx=this.ctx();
    if(ctx.state==='suspended')ctx.resume();
    let next=ctx.currentTime+0.05;
    const loop=()=>{
      if(!this._playing)return;
      next=this._schedule(next);
      this._timer=setTimeout(loop,(next-ctx.currentTime-0.5)*1000);
    };
    loop();
  },
  stop(){
    this._playing=false; clearTimeout(this._timer);
    if(this._master){
      const t=this.ctx().currentTime;
      this._master.gain.setValueAtTime(this._master.gain.value,t);
      this._master.gain.linearRampToValueAtTime(0,t+0.4);
      setTimeout(()=>{if(this._master)this._master.gain.value=0.10;},500);
    }
  },
  toggle(){this._playing?this.stop():this.start();},
  playing(){return this._playing;},
};

// ── QUIZ BANK ─────────────────────────────────────────────────
const QUIZ_BANK = {
  "JavaScript":[
    {question:"What does `typeof null` return in JavaScript?",options:["A. null","B. object","C. undefined","D. string"],correct:1,explanation:"`typeof null` returns 'object' — a famous JavaScript bug kept for backward compatibility.",fun_fact:"Brendan Eich created JavaScript in just 10 days in 1995!"},
    {question:"Which array method removes the LAST element?",options:["A. shift()","B. splice()","C. pop()","D. slice()"],correct:2,explanation:"`pop()` removes and returns the last element. `shift()` removes the first.",fun_fact:"JavaScript arrays are objects under the hood — hence their quirky behaviors!"},
    {question:"What does `===` check in JavaScript?",options:["A. Value only","B. Type only","C. Value AND type","D. Reference equality"],correct:2,explanation:"`===` is strict equality — checks both value AND type without coercion.",fun_fact:"Using `==` instead can cause bugs: `0 == '0'` is true but `0 === '0'` is false!"},
    {question:"What is a closure in JavaScript?",options:["A. A way to end loops","B. A function that retains its outer scope","C. An error handler","D. A module pattern"],correct:1,explanation:"A closure is a function that 'closes over' variables from its outer scope, retaining access even after the outer function returns.",fun_fact:"Closures are the foundation of JavaScript module patterns and private variables!"},
    {question:"What does the `async` keyword do to a function?",options:["A. Makes it run faster","B. Makes it return a Promise","C. Runs it in a Web Worker","D. Disables error handling"],correct:1,explanation:"An `async` function always returns a Promise, enabling use of `await` inside it.",fun_fact:"Node.js I/O is non-blocking, making async/await especially powerful there!"},
    {question:"Which method creates a new array with transformed elements?",options:["A. filter()","B. reduce()","C. forEach()","D. map()"],correct:3,explanation:"`map()` returns a new array with the result of calling a function on each element.",fun_fact:"Functional array methods like map/filter/reduce come from Functional Programming concepts!"},
    {question:"What is the difference between `let` and `var`?",options:["A. No difference","B. `let` is block-scoped, `var` is function-scoped","C. `var` is newer than `let`","D. `let` cannot be reassigned"],correct:1,explanation:"`let` is block-scoped (limited to `{}` blocks) while `var` is function-scoped and hoisted — `let` prevents many classic bugs.",fun_fact:"Before `let` and `const` (ES6 2015), all JavaScript variables were declared with `var`!"},
    {question:"What is event bubbling in JavaScript?",options:["A. Events firing twice","B. An event propagating up from child to parent elements","C. Async event handling","D. A jQuery feature"],correct:1,explanation:"Event bubbling means a click on a child element also triggers handlers on all its ancestor elements, going up to the root.",fun_fact:"You can stop bubbling with `event.stopPropagation()` — useful but can break accessibility if overused!"},
    {question:"What does `Promise.all()` do?",options:["A. Runs promises one by one","B. Cancels all promises","C. Waits for all promises to resolve (or one to reject)","D. Returns the first resolved promise"],correct:2,explanation:"`Promise.all([p1, p2])` runs promises in parallel and resolves when all succeed, or rejects if any fail.",fun_fact:"For 'first success wins' behavior, use `Promise.race()` or `Promise.any()` instead!"},
    {question:"What does the spread operator `...` do in JavaScript?",options:["A. Creates a generator function","B. Spreads iterable elements into individual values","C. Declares rest parameters only","D. Deep clones objects"],correct:1,explanation:"The spread operator `...` expands an array or object into individual elements — useful for copying, merging, and passing args.",fun_fact:"The spread operator was introduced in ES6 (2015) and is now one of the most-used modern JS features!"},
  ],
  "Operations":[
    {question:"What does SLA stand for in IT Operations?",options:["A. Software License Agreement","B. Service Level Agreement","C. System Load Average","D. Secure Login Access"],correct:1,explanation:"SLA = Service Level Agreement — a contract defining the expected level of service (uptime, response time) between provider and customer.",fun_fact:"Amazon's S3 SLA guarantees 99.9% monthly uptime — just 8.7 hours downtime allowed per year!"},
    {question:"What does RTO stand for in disaster recovery?",options:["A. Real-Time Operations","B. Recovery Time Objective","C. Redundant Transfer Order","D. Response Timeout Override"],correct:1,explanation:"RTO = Recovery Time Objective — the maximum acceptable time to restore a system after a failure.",fun_fact:"Top financial systems aim for RTO of under 15 minutes to minimize revenue loss!"},
    {question:"What is a 'runbook' in IT Operations?",options:["A. A sprint backlog","B. A document of step-by-step procedures for operations tasks","C. A load testing tool","D. An on-call schedule"],correct:1,explanation:"A runbook contains documented procedures for routine and emergency operations — reducing human error during incidents.",fun_fact:"Well-maintained runbooks can reduce MTTR (Mean Time To Repair) by over 60%!"},
    {question:"What does MTTR stand for?",options:["A. Maximum Transfer Time Rate","B. Mean Time To Repair","C. Monitoring Threshold Trigger Rate","D. Managed Traffic Throughput Ratio"],correct:1,explanation:"MTTR = Mean Time To Repair — the average time needed to fix a failed system or component.",fun_fact:"Google's SRE teams track MTTR rigorously — the goal is always to drive it closer to zero!"},
    {question:"What is the purpose of a post-mortem in operations?",options:["A. Terminate a project","B. Analyze a past incident to prevent recurrence","C. Close a support ticket","D. Archive old logs"],correct:1,explanation:"A blameless post-mortem documents what happened, why, and how to prevent it — improving system resilience.",fun_fact:"Netflix's famous 'chaos engineering' culture was born from post-mortem learnings after a major 2008 outage!"},
    {question:"What is 'on-call rotation' in DevOps/Ops?",options:["A. A meeting schedule","B. A system where team members take turns being responsible for incident response","C. A network failover plan","D. A daily code review"],correct:1,explanation:"On-call rotation ensures 24/7 coverage — team members alternate being the first responder to production alerts.",fun_fact:"PagerDuty reports that the average on-call engineer receives 25+ alerts per week!"},
    {question:"What is a load balancer?",options:["A. A CPU monitoring tool","B. Distributes incoming traffic across multiple servers","C. A database optimizer","D. A CI/CD component"],correct:1,explanation:"A load balancer distributes incoming requests across a pool of servers to prevent any one server from being overwhelmed.",fun_fact:"AWS Elastic Load Balancer can handle millions of requests per second and auto-scales to demand!"},
    {question:"What does RPO stand for in disaster recovery?",options:["A. Real-time Processing Order","B. Recovery Point Objective","C. Remote Procedure Operation","D. Redundant Process Oversight"],correct:1,explanation:"RPO = Recovery Point Objective — the maximum acceptable amount of data loss measured in time (e.g., 'we can afford to lose at most 1 hour of data').",fun_fact:"Banks often require an RPO of near-zero, driving expensive synchronous replication setups!"},
    {question:"What is blue-green deployment?",options:["A. Deploying to Linux and Windows simultaneously","B. Running two identical environments where traffic is switched between them","C. A color-coded sprint board system","D. Multi-region replication strategy"],correct:1,explanation:"Blue-green deployment keeps two identical production environments — 'blue' (live) and 'green' (new). Traffic is switched instantly, enabling zero-downtime releases and easy rollbacks.",fun_fact:"Netflix popularized blue-green deployments and can now deploy to production thousands of times per day!"},
    {question:"What is 'capacity planning' in operations?",options:["A. Planning office seating","B. Forecasting and provisioning resources to handle future demand","C. Setting team KPIs","D. Writing runbooks"],correct:1,explanation:"Capacity planning predicts future resource needs (CPU, memory, storage) based on growth trends — avoiding performance degradation before it happens.",fun_fact:"Poor capacity planning caused Twitter's 'Fail Whale' outages during viral events in the late 2000s!"},
  ],
  "AI & ML":[
    {question:"What does LLM stand for?",options:["A. Large Language Model","B. Linear Learning Machine","C. Layered Logic Module","D. Lightweight Language Metric"],correct:0,explanation:"LLM = Large Language Model — AI systems trained on massive text data, like GPT and Claude.",fun_fact:"GPT-4 was trained on roughly 1 trillion tokens — more words than a human reads in thousands of lifetimes!"},
    {question:"What is 'overfitting' in machine learning?",options:["A. Model is too simple","B. Model memorizes training data but fails on new data","C. Too much training data","D. Model runs too slow"],correct:1,explanation:"Overfitting happens when a model learns training data too well, including noise, so it can't generalize.",fun_fact:"Regularization techniques like dropout were invented specifically to fight overfitting!"},
    {question:"What does 'training' a model mean?",options:["A. Writing its code","B. Adjusting weights on data to minimize error","C. Running it on a GPU","D. Deploying it to production"],correct:1,explanation:"Training adjusts the model's parameters (weights) iteratively to reduce prediction error on training data.",fun_fact:"GPT-3 required roughly 3,640 petaflop/s-days of compute to train!"},
    {question:"What is the 'transformer' in AI models like GPT?",options:["A. A power adapter","B. An architecture using attention mechanisms","C. A data pipeline","D. A compression algorithm"],correct:1,explanation:"The Transformer architecture (2017) uses 'attention' to weigh word relationships, enabling modern LLMs.",fun_fact:"The paper 'Attention is All You Need' introduced Transformers — arguably the most impactful AI paper of the decade!"},
    {question:"What does 'neural network' mean?",options:["A. A type of internet protocol","B. Layers of interconnected nodes inspired by the human brain","C. A database structure","D. A security framework"],correct:1,explanation:"Neural networks mimic biological neurons — layers of nodes with weighted connections that learn patterns.",fun_fact:"The human brain has ~86 billion neurons. The largest AI models have ~1 trillion parameters!"},
    {question:"What is 'prompt engineering'?",options:["A. Hardware optimization","B. Crafting inputs to guide AI output","C. Training a model","D. Deploying AI to cloud"],correct:1,explanation:"Prompt engineering is the skill of writing effective inputs to get desired outputs from AI models.",fun_fact:"A well-crafted prompt can improve AI accuracy by over 50% on complex reasoning tasks!"},
    {question:"What is 'fine-tuning' in AI?",options:["A. Adjusting volume on audio models","B. Updating a pre-trained model with domain-specific data","C. Compressing a neural network","D. Increasing model parameters"],correct:1,explanation:"Fine-tuning takes a pre-trained model and continues training it on a smaller, specific dataset — adapting it to a specific task or domain.",fun_fact:"OpenAI's fine-tuning API lets you train GPT models on your own data for specialized tasks!"},
    {question:"What does RAG stand for in AI?",options:["A. Rapid Action Generation","B. Retrieval-Augmented Generation","C. Recursive Agent Graph","D. Ranked Attention Guide"],correct:1,explanation:"RAG = Retrieval-Augmented Generation — combines a retrieval system (like a vector database) with an LLM so it can answer questions from up-to-date knowledge.",fun_fact:"RAG was introduced by Meta AI in 2020 and is now the most popular way to build LLM apps with private data!"},
    {question:"What does 'hallucination' mean in LLMs?",options:["A. The model generating images","B. The model confidently producing false or made-up information","C. A training data error","D. Slow inference speed"],correct:1,explanation:"Hallucination is when an LLM generates plausible-sounding but factually incorrect information — a key challenge in AI reliability.",fun_fact:"In a 2023 study, ChatGPT hallucinated legal case citations that didn't exist, causing a lawyer to be sanctioned!"},
    {question:"What is a 'token' in the context of LLMs?",options:["A. A security authentication code","B. A chunk of text (word or subword) that the model processes","C. A model parameter","D. An API key"],correct:1,explanation:"LLMs tokenize text into smaller units — roughly 4 characters or ¾ of a word per token. Models have token limits for context windows.",fun_fact:"GPT-4's 128K token context window can hold roughly 100,000 words — almost the length of a full novel!"},
  ],
  "Cloud":[
    {question:"What does SaaS stand for?",options:["A. Software as a Service","B. System as a Stack","C. Storage as a Solution","D. Server as a Service"],correct:0,explanation:"SaaS delivers software over the internet on subscription — like Gmail, Slack, or Salesforce.",fun_fact:"The global SaaS market is projected to exceed $900 billion by 2030!"},
    {question:"Which AWS service is used for serverless functions?",options:["A. EC2","B. S3","C. Lambda","D. RDS"],correct:2,explanation:"AWS Lambda runs code in response to events without managing servers — true serverless compute.",fun_fact:"AWS Lambda functions can scale from 0 to thousands of concurrent executions in seconds!"},
    {question:"What does CDN stand for?",options:["A. Cloud Data Node","B. Content Delivery Network","C. Central DNS Name","D. Cached Data Network"],correct:1,explanation:"A CDN distributes content across servers worldwide so users load it from a nearby location — reducing latency.",fun_fact:"Cloudflare's CDN now serves about 20% of all internet traffic!"},
    {question:"What is auto-scaling in cloud?",options:["A. Automatic OS updates","B. Adjusting compute resources based on load","C. Scaling database rows","D. Auto-backup of files"],correct:1,explanation:"Auto-scaling automatically adds or removes resources based on demand — scaling up under load, down when idle.",fun_fact:"Netflix uses AWS auto-scaling to handle 200+ million subscribers without managing a single server!"},
    {question:"What is the main advantage of microservices?",options:["A. Everything in one codebase","B. Each service is independently deployable and scalable","C. Faster to build initially","D. No network calls needed"],correct:1,explanation:"Microservices split apps into small, independent services — each can be deployed, scaled, and updated separately.",fun_fact:"Amazon decomposed its monolith into microservices in 2001, becoming the foundation of AWS!"},
    {question:"What does 'IaC' mean in DevOps?",options:["A. Integration as Code","B. Infrastructure as Code","C. Instance and Cluster","D. Input and Configuration"],correct:1,explanation:"IaC manages cloud infrastructure through code (like Terraform or CloudFormation) instead of manual setup.",fun_fact:"IaC reduces infrastructure deployment time from weeks to minutes!"},
    {question:"What is 'object storage' in cloud?",options:["A. Storing JavaScript objects in memory","B. Storing files as flat objects with metadata and a unique key","C. A relational database service","D. A Docker image registry"],correct:1,explanation:"Object storage (like AWS S3) stores data as objects with a key, metadata, and the data itself — ideal for images, videos, and backups.",fun_fact:"Amazon S3 stores over 100 trillion objects and was one of AWS's first services, launched in 2006!"},
    {question:"What does PaaS stand for?",options:["A. Private as a Service","B. Platform as a Service","C. Processing as a Service","D. Protocol and Security"],correct:1,explanation:"PaaS provides a platform to build, run, and manage apps without managing the underlying infrastructure — like Heroku or Google App Engine.",fun_fact:"Heroku, one of the first PaaS platforms, let developers deploy apps in seconds — revolutionary in 2007!"},
    {question:"What is an availability zone in cloud?",options:["A. A billing region","B. An isolated data center within a cloud region","C. A global content cache","D. A virtual private network"],correct:1,explanation:"Availability zones are isolated data centers within a region — deploying across multiple AZs protects apps from single datacenter failures.",fun_fact:"AWS has 100+ availability zones across 30+ geographic regions worldwide!"},
    {question:"What is 'egress' in cloud pricing?",options:["A. Storing data in the cloud","B. Data transferred OUT of the cloud to the internet","C. Compute processing cost","D. Cost of inbound API calls"],correct:1,explanation:"Cloud providers charge for egress (outbound) traffic but usually not for ingress (inbound). This is a major factor in cloud costs.",fun_fact:"Many companies pay millions in egress fees — it's a key reason the 'cloud repatriation' trend exists!"},
  ],
  "React":[
    {question:"Which hook manages state in React functional components?",options:["A. useEffect","B. useRef","C. useState","D. useContext"],correct:2,explanation:"`useState` returns a state value and a setter function — calling the setter triggers a re-render.",fun_fact:"Before hooks (React 16.8), you needed class components for any stateful logic!"},
    {question:"What does JSX stand for?",options:["A. JavaScript XML","B. Java Syntax Extension","C. JSON XML","D. JavaScript Extra"],correct:0,explanation:"JSX is a syntax extension that lets you write HTML-like code inside JavaScript — Babel compiles it to `React.createElement()`.",fun_fact:"JSX is entirely optional — React can be used without it, but most developers prefer it!"},
    {question:"What does `useEffect` with an empty `[]` dependency array do?",options:["A. Runs on every render","B. Runs only once after mount","C. Runs before render","D. Never runs"],correct:1,explanation:"An empty dependency array `[]` means the effect runs once after the component mounts — like `componentDidMount`.",fun_fact:"Forgetting dependencies in `useEffect` is one of the most common React bugs!"},
    {question:"What is the Virtual DOM?",options:["A. A fake browser environment","B. A lightweight in-memory copy of the real DOM","C. A CSS rendering engine","D. A JavaScript runtime"],correct:1,explanation:"React's Virtual DOM is an in-memory representation — React diffs it against the real DOM and only updates what changed.",fun_fact:"React's Virtual DOM reconciliation was revolutionary in 2013 when React was released!"},
    {question:"What does lifting state up mean in React?",options:["A. Putting state in localStorage","B. Moving state to a parent component","C. Using Redux","D. Calling setState faster"],correct:1,explanation:"When sibling components need to share state, you move (lift) that state to their closest common ancestor.",fun_fact:"Lifting state is often the first step before reaching for Redux or Context API!"},
    {question:"What is React's key prop used for?",options:["A. Encryption","B. Styling list items","C. Helping React identify which items changed in a list","D. Event handling"],correct:2,explanation:"The `key` prop helps React efficiently reconcile lists — it identifies which items were added, changed, or removed.",fun_fact:"Using array index as key is an anti-pattern — it can cause subtle bugs when lists reorder!"},
    {question:"What is 'prop drilling' in React?",options:["A. A React performance tool","B. Passing props through many component layers just to reach a deeply nested child","C. Drilling holes in your design system","D. Using refs instead of props"],correct:1,explanation:"Prop drilling is when you pass data through multiple intermediate components that don't need it — just to reach a deeply nested component. Context API or state managers solve this.",fun_fact:"Redux was created largely to solve prop drilling — though React's own Context API now covers many of those use cases!"},
    {question:"What does `React.memo()` do?",options:["A. Memoizes a value","B. Prevents a component from re-rendering if its props haven't changed","C. Stores component state in memory","D. Caches API responses"],correct:1,explanation:"`React.memo()` wraps a functional component and skips re-renders when props haven't changed — a performance optimization.",fun_fact:"Overusing `React.memo` can actually hurt performance — the comparison itself has a cost!"},
    {question:"What does `useCallback` do in React?",options:["A. Runs a side effect","B. Memoizes a function to prevent it from being recreated on every render","C. Cancels async operations","D. Replaces useState"],correct:1,explanation:"`useCallback(fn, deps)` returns a memoized version of the function — only recreated when deps change. Useful when passing callbacks to optimized child components.",fun_fact:"Use `useCallback` together with `React.memo` on child components to prevent unnecessary re-renders!"},
    {question:"What is the React Context API used for?",options:["A. Styling components globally","B. Sharing state across the component tree without prop drilling","C. Managing API requests","D. Lazy loading components"],correct:1,explanation:"Context API provides a way to share values (like theme or user auth) across all levels of a component tree without manual prop passing.",fun_fact:"React Context was redesigned in React 16.3 — the old `childContextTypes` API is now fully removed in React 19!"},
  ],
  "Databases":[
    {question:"What does SQL stand for?",options:["A. Structured Query Language","B. Simple Queue Logic","C. System Query List","D. Stored Query Layer"],correct:0,explanation:"SQL = Structured Query Language — the standard language for managing relational databases.",fun_fact:"SQL was invented at IBM in the 1970s and is still the most used database language today!"},
    {question:"Which of these is NOT a NoSQL database?",options:["A. MongoDB","B. Redis","C. MySQL","D. Cassandra"],correct:2,explanation:"MySQL is a relational (SQL) database. MongoDB, Redis, and Cassandra are all NoSQL databases.",fun_fact:"NoSQL databases were popularized in the 2000s by companies like Google, Amazon, and Facebook!"},
    {question:"What does ACID stand for in databases?",options:["A. Atomicity, Consistency, Isolation, Durability","B. Access, Control, Index, Data","C. Async, Cache, Integrity, Deploy","D. Application, Config, Index, Deploy"],correct:0,explanation:"ACID properties guarantee reliable database transactions even in case of errors or crashes.",fun_fact:"Banks rely on ACID compliance to ensure your money never disappears during a failed transaction!"},
    {question:"Which SQL keyword removes duplicate rows from results?",options:["A. UNIQUE","B. DISTINCT","C. FILTER","D. REMOVE"],correct:1,explanation:"`SELECT DISTINCT column FROM table` returns only unique values, removing duplicates.",fun_fact:"The DISTINCT keyword can significantly slow queries on large tables without proper indexing!"},
    {question:"What is a database index?",options:["A. A table's row count","B. A data structure that speeds up row retrieval","C. A backup file","D. A schema constraint"],correct:1,explanation:"An index is like a book's index — it lets the database find rows quickly without scanning every row.",fun_fact:"A well-placed index can reduce query time from minutes to milliseconds on large tables!"},
    {question:"What is the purpose of a foreign key?",options:["A. Encrypting data","B. Linking rows between two tables","C. Speeding up queries","D. Counting records"],correct:1,explanation:"A foreign key creates a link between rows in two tables, enforcing referential integrity.",fun_fact:"Forgetting foreign key constraints is a classic cause of orphaned records in production databases!"},
    {question:"What is a JOIN in SQL?",options:["A. A way to merge two databases","B. Combining rows from two or more tables based on a related column","C. A type of index","D. A stored procedure"],correct:1,explanation:"JOIN lets you query data across related tables. INNER JOIN returns matching rows; LEFT JOIN includes all from the left table even without matches.",fun_fact:"A poorly written JOIN on large tables without indexes can bring down a production database in seconds!"},
    {question:"What is database sharding?",options:["A. Encrypting database rows","B. Splitting a large database across multiple servers","C. Creating database backups","D. Compressing table data"],correct:1,explanation:"Sharding horizontally splits a large database into smaller partitions (shards) spread across servers — enabling horizontal scalability.",fun_fact:"Instagram sharded its PostgreSQL database at 25 million users and again at 100 million — both times under tight deadlines!"},
    {question:"What does ORM stand for in backend development?",options:["A. Object-Relational Mapping","B. Open REST Module","C. Optimized Record Management","D. Object Reference Model"],correct:0,explanation:"ORM = Object-Relational Mapping — tools like Prisma, Sequelize, or Hibernate let you query databases using your language's objects instead of raw SQL.",fun_fact:"ORMs can reduce boilerplate by 70%, but raw SQL is often still faster for complex queries!"},
    {question:"What is database normalization?",options:["A. Setting all values to 0","B. Organizing data to reduce redundancy and improve integrity","C. Converting a database to NoSQL","D. Backing up data regularly"],correct:1,explanation:"Normalization organizes tables so data isn't repeated — splitting into smaller related tables connected by keys. It reduces anomalies during updates.",fun_fact:"Most production databases aim for 3NF (Third Normal Form) — beyond that often hurts read performance!"},
  ],
  "Cyber Security":[
    {question:"What does HTTPS stand for?",options:["A. Hyper Text Transfer Protocol Secure","B. High Transfer Protocol System","C. Hyper Text Transport Protocol Standard","D. Host Transfer Protocol Secure"],correct:0,explanation:"HTTPS encrypts data between browser and server using TLS — the padlock icon in your browser.",fun_fact:"By 2023, over 95% of traffic on Chrome loads over HTTPS!"},
    {question:"What is phishing?",options:["A. A type of firewall","B. Tricking users into revealing sensitive info","C. An encryption algorithm","D. A network scanning tool"],correct:1,explanation:"Phishing uses fake emails or sites to trick people into giving up passwords, credit cards, or other sensitive data.",fun_fact:"90% of data breaches start with a phishing attack!"},
    {question:"What does 2FA stand for?",options:["A. Two-Factor Authentication","B. Two-File Access","C. Twice-Fast Authorization","D. Two-Form Approval"],correct:0,explanation:"2FA requires two proofs of identity — e.g. password + SMS code — making accounts much harder to compromise.",fun_fact:"Accounts with 2FA are 99.9% less likely to be compromised, according to Microsoft!"},
    {question:"What is a SQL Injection attack?",options:["A. Overloading a server","B. Inserting malicious SQL into input fields to manipulate the database","C. Brute-forcing passwords","D. Stealing cookies"],correct:1,explanation:"SQL injection tricks apps into running attacker-supplied SQL, potentially exposing or deleting all data.",fun_fact:"SQL injection has been the #1 web vulnerability in OWASP's top 10 for many years!"},
    {question:"What is a VPN?",options:["A. A type of virus","B. An encrypted tunnel for internet traffic","C. A password manager","D. A firewall system"],correct:1,explanation:"A VPN (Virtual Private Network) encrypts your internet traffic and masks your IP address.",fun_fact:"VPN usage surged 150% in 2020 as millions switched to remote work!"},
    {question:"What is the best practice for storing passwords?",options:["A. Plain text","B. Base64 encoded","C. Hashed with bcrypt or Argon2","D. AES encrypted"],correct:2,explanation:"Passwords must be hashed (not encrypted) using slow algorithms like bcrypt — making brute-force attacks impractical.",fun_fact:"The 2012 LinkedIn breach exposed 117M passwords stored with weak SHA-1 — most were cracked in days!"},
    {question:"What is a man-in-the-middle (MITM) attack?",options:["A. Social engineering via phone","B. An attacker secretly intercepts communication between two parties","C. Password brute-forcing","D. DDoS attack variant"],correct:1,explanation:"In a MITM attack, the attacker secretly intercepts and potentially alters communication between two parties who believe they're talking directly to each other.",fun_fact:"HTTPS with certificate pinning is the main defense against MITM attacks on web apps!"},
    {question:"What is a zero-day vulnerability?",options:["A. A bug that causes zero downtime","B. A flaw unknown to the vendor with no available patch","C. A test environment issue","D. An expired SSL certificate"],correct:1,explanation:"A zero-day is a vulnerability that's unknown to the software vendor — attackers can exploit it before any patch exists.",fun_fact:"A single critical zero-day exploit can sell for millions of dollars on the dark web!"},
    {question:"What does XSS stand for in web security?",options:["A. Cross-Site Scripting","B. External Script System","C. Extra Secure Socket","D. Cross-Server Session"],correct:0,explanation:"XSS (Cross-Site Scripting) lets attackers inject malicious scripts into web pages viewed by other users — used to steal sessions or redirect users.",fun_fact:"XSS attacks can use something as simple as `<script>alert(document.cookie)</script>` in an input field!"},
    {question:"What is 'social engineering' in cybersecurity?",options:["A. Using AI to break passwords","B. Manipulating people psychologically to reveal information or take harmful actions","C. Network packet analysis","D. A type of firewall evasion"],correct:1,explanation:"Social engineering exploits human psychology rather than technical vulnerabilities — e.g. impersonating IT support to get someone to reveal their password.",fun_fact:"Kevin Mitnick, once the world's most-wanted hacker, relied primarily on social engineering rather than technical exploits!"},
  ],
  "Git & DevOps":[
    {question:"Which command creates a new Git branch?",options:["A. git new branch","B. git branch <name>","C. git fork","D. git create"],correct:1,explanation:"`git branch <name>` creates a new branch. Use `git checkout -b <name>` to create and switch in one step.",fun_fact:"Git was created by Linus Torvalds in 2005 to manage the Linux kernel source code!"},
    {question:"What does CI/CD stand for?",options:["A. Code Integration/Code Deployment","B. Continuous Integration/Continuous Delivery","C. Complete Install/Complete Deploy","D. Cloud Integration/Cloud Delivery"],correct:1,explanation:"CI/CD automates building, testing, and deploying code — enabling teams to ship faster with confidence.",fun_fact:"Top tech companies deploy code hundreds of times per day using CI/CD pipelines!"},
    {question:"What does `git stash` do?",options:["A. Deletes uncommitted changes","B. Pushes to remote","C. Saves uncommitted changes temporarily","D. Merges branches"],correct:2,explanation:"`git stash` saves your work-in-progress without committing, so you can switch branches cleanly.",fun_fact:"You can have multiple stashes and apply them selectively with `git stash list`!"},
    {question:"What is Docker used for?",options:["A. Version control","B. Database management","C. Containerizing applications","D. Load balancing"],correct:2,explanation:"Docker packages apps with all dependencies into containers — ensuring consistent behavior across environments.",fun_fact:"Docker was released in 2013 and now has over 7 million images on Docker Hub!"},
    {question:"What does `git rebase` do?",options:["A. Merges two branches","B. Rewrites commit history by replaying commits onto another branch","C. Reverts the last commit","D. Creates a branch"],correct:1,explanation:"`git rebase` moves or replays commits onto a new base — creating a cleaner linear history than merge.",fun_fact:"Git rebase is powerful but can cause problems if used on shared/public branches!"},
    {question:"What is the purpose of a `.gitignore` file?",options:["A. Lists required dependencies","B. Specifies files Git should not track","C. Defines CI/CD pipelines","D. Configures git username"],correct:1,explanation:"`.gitignore` tells Git to ignore specified files/folders — like `node_modules`, `.env`, or build artifacts.",fun_fact:"GitHub provides `.gitignore` templates for hundreds of languages and frameworks!"},
    {question:"What is a pull request (PR)?",options:["A. Pulling the latest code from remote","B. A request to merge code changes from one branch into another","C. Requesting read access to a repo","D. Downloading a repository"],correct:1,explanation:"A pull request is a way to propose code changes — team members can review, comment, and approve before the code is merged into the main branch.",fun_fact:"GitHub introduced pull requests in 2008 — they became the foundation of open-source collaboration at scale!"},
    {question:"What does `git merge --squash` do?",options:["A. Deletes merged branches","B. Combines all commits from a branch into one commit before merging","C. Force-pushes to main","D. Reverts a merge"],correct:1,explanation:"`--squash` collapses all commits from the feature branch into a single commit on the target branch — keeping history clean.",fun_fact:"Many teams use squash merging to maintain a clean `main` branch history — one feature = one commit!"},
    {question:"What is Kubernetes used for?",options:["A. Source code management","B. Orchestrating and managing containerized applications at scale","C. SQL database management","D. Network packet analysis"],correct:1,explanation:"Kubernetes (K8s) automates deploying, scaling, and managing containerized apps — handling load balancing, self-healing, and rolling updates.",fun_fact:"Kubernetes was open-sourced by Google in 2014, based on their internal 'Borg' system that ran Google's entire infrastructure!"},
    {question:"What is a deployment pipeline?",options:["A. A network routing table","B. An automated sequence: build → test → deploy","C. A monitoring dashboard","D. A database migration script"],correct:1,explanation:"A deployment pipeline automates the steps from committing code to production — typically: build, run tests, deploy to staging, then deploy to production.",fun_fact:"A well-optimized pipeline at Netflix deploys code to 200M+ users in under 16 minutes!"},
  ],
};
function shuffle(arr){const a=[...arr];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}

// ── AI OR HUMAN BANK ──────────────────────────────────────────
const AH_BANK=[
  {prompt:"What's one thing you love about coding?",text:"Honestly? When something finally works after 3 hours of debugging. That dopamine hit is unreal lol",isAI:false},
  {prompt:"What's one thing you love about coding?",text:"The elegance of transforming abstract logic into something tangible — where a few precise keystrokes can automate what once took hours.",isAI:true},
  {prompt:"Describe AI in one sentence",text:"It's autocomplete on steroids that somehow got a job, a personality, and opinions about everything.",isAI:false},
  {prompt:"Describe AI in one sentence",text:"AI is the science of enabling machines to perform tasks that typically require human intelligence, like understanding language or recognizing patterns.",isAI:true},
  {prompt:"Best advice for a junior developer?",text:"Google everything. No seriously, even seniors google basic stuff daily. The skill is knowing WHAT to search.",isAI:false},
  {prompt:"Best advice for a junior developer?",text:"Focus on fundamentals over frameworks — understanding why code works matters far more than memorizing syntax.",isAI:true},
  {prompt:"Your hot take on JavaScript?",text:"It's chaotic and weird and I hate it but I also use it for literally everything so here we are.",isAI:false},
  {prompt:"Your hot take on JavaScript?",text:"JavaScript's quirky type coercion gets unfair criticism — its flexibility is precisely what made it the universal language of the web.",isAI:true},
  {prompt:"How would you explain Git to a 5-year-old?",text:"It's like a save button that remembers EVERYTHING, and lets you undo anything. But also lets your friends save too without breaking yours.",isAI:false},
  {prompt:"How would you explain Git to a 5-year-old?",text:"Git is like a magical notebook that saves every version of your work, so you can always go back to any earlier version whenever you want.",isAI:true},
  {prompt:"What's the most overused buzzword in tech?",text:"Synergy. Or AI-powered. Or disruption. All three, sometimes in the same sentence, usually from someone who's never written code.",isAI:false},
  {prompt:"What's the most overused buzzword in tech?",text:"Without question, 'disruptive innovation' — a phrase that once meant something but now precedes every product announcement regardless of actual novelty.",isAI:true},
  {prompt:"What would you tell your past self starting to code?",text:"Stop trying to memorize syntax and just build stuff. The docs will always be there. Your motivation won't.",isAI:false},
  {prompt:"What would you tell your past self starting to code?",text:"Embrace confusion as a signal of growth rather than failure — every senior developer you admire was once exactly where you are now.",isAI:true},
  {prompt:"Describe debugging in one sentence",text:"Adding console.log everywhere and whispering 'why' until something makes sense, then deleting them all and hoping nothing breaks.",isAI:false},
  {prompt:"Describe debugging in one sentence",text:"Debugging is detective work — you form hypotheses, test them systematically, and discover that your assumptions, not the code, were usually wrong.",isAI:true},
  {prompt:"What do you think about no-code tools?",text:"Great for people who need to ship fast. Terrifying for devs who now need to explain why they spent 3 days on something Webflow does in 20 minutes.",isAI:false},
  {prompt:"What do you think about no-code tools?",text:"No-code tools democratize software creation admirably, but introduce abstraction layers that can obscure logic and limit customization at scale.",isAI:true},
  {prompt:"What's your opinion on code comments?",text:"Write comments for future-you who has no idea why you made that weird decision at 2am. Future-you will thank present-you.",isAI:false},
  {prompt:"What's your opinion on code comments?",text:"The best code is self-documenting, but comments shine when explaining the 'why' behind non-obvious decisions that would otherwise confuse future maintainers.",isAI:true},
  {prompt:"What does 'good code' mean to you?",text:"Code that junior devs can read without a 30-minute explanation. If you need to explain it, it's probably not that good.",isAI:false},
  {prompt:"What does 'good code' mean to you?",text:"Good code is readable, testable, and does exactly one thing well — its elegance lies not in complexity but in how little explanation it needs.",isAI:true},
  {prompt:"Describe your perfect tech stack",text:"Whatever works and doesn't wake me up at 3am. But if forced: Next.js, Postgres, Tailwind, and unlimited coffee.",isAI:false},
  {prompt:"Describe your perfect tech stack",text:"An ideal stack balances developer experience with production reliability — TypeScript for safety, React for UI, Node for APIs, PostgreSQL for data.",isAI:true},
  {prompt:"Rate Python out of 10",text:"9/10. Would be 10 but the whitespace thing still haunts me after switching from JS. Also pip is a mess sometimes ngl.",isAI:false},
  {prompt:"Rate Python out of 10",text:"Python earns a solid 8/10 — its readable syntax democratizes programming, though performance limitations keep it from perfection in compute-heavy tasks.",isAI:true},
  {prompt:"Give your take on remote work for developers",text:"Productivity depends on whether your flatmates also work from home. Mine don't. It's a daily negotiation with distractions.",isAI:false},
  {prompt:"Give your take on remote work for developers",text:"Remote work empowers developers with deep-focus time that open offices rarely allow, though it demands intentional communication to replace spontaneous collaboration.",isAI:true},
  {prompt:"What's cloud computing in simple terms?",text:"It's someone else's computer that you pay for monthly and cry about when the bill comes.",isAI:false},
  {prompt:"What's cloud computing in simple terms?",text:"Cloud computing delivers on-demand computing resources over the internet, enabling scalability and flexibility without managing physical infrastructure.",isAI:true},
];

// ── CSS ───────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Rajdhani:wght@400;600;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
body{background:#07080f;overflow-x:hidden;}
@keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
@keyframes pop{0%{transform:scale(0.4);opacity:0}65%{transform:scale(1.15)}100%{transform:scale(1);opacity:1}}
@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-9px)}75%{transform:translateX(9px)}}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}
@keyframes floatUp{0%{transform:translateY(0) scale(1);opacity:1}100%{transform:translateY(-230px) scale(0.3);opacity:0}}
@keyframes ticker{0%{transform:translateX(100vw)}100%{transform:translateX(-100%)}}
@keyframes introIn{0%{transform:scale(0.2) rotateX(60deg);opacity:0}100%{transform:scale(1) rotateX(0deg);opacity:1}}
@keyframes glowPulse{0%,100%{box-shadow:0 0 8px #ffe60040}50%{box-shadow:0 0 28px #ffe600,0 0 55px #ffe60040}}
@keyframes winGlow{0%,100%{box-shadow:0 0 12px #ffe60040}50%{box-shadow:0 0 36px #ffe600,0 0 72px #ffe60060}}
@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
@keyframes podiumRise{from{transform:translateY(60px);opacity:0}to{transform:translateY(0);opacity:1}}
@keyframes scanMove{0%{top:-100%}100%{top:100%}}
.scanlines{position:fixed;inset:0;pointer-events:none;z-index:9997;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.05) 2px,rgba(0,0,0,0.05) 4px);}
.ticker-wrap{overflow:hidden;white-space:nowrap;background:#090b18;border-top:1px solid #1a2040;border-bottom:1px solid #1a2040;padding:5px 0;}
.ticker-text{display:inline-block;animation:ticker 24s linear infinite;font-family:Orbitron,sans-serif;font-size:0.56rem;letter-spacing:0.2em;color:#1e2848;}
@keyframes buzzerFlash{0%,100%{opacity:1;transform:scale(1)}25%{opacity:0.4;transform:scale(0.97)}50%{opacity:1;transform:scale(1.04)}75%{opacity:0.4;transform:scale(0.97)}}
@keyframes readyPulse{0%,100%{box-shadow:0 0 10px currentColor,0 0 0px currentColor}50%{box-shadow:0 0 28px currentColor,0 0 55px currentColor}}
@keyframes buzzWin{0%{transform:scale(1)}15%{transform:scale(1.07)}30%{transform:scale(0.96)}45%{transform:scale(1.05)}60%{transform:scale(0.98)}100%{transform:scale(1)}}
@keyframes countdownPop{0%{transform:scale(0.3);opacity:0}60%{transform:scale(1.2)}100%{transform:scale(1);opacity:1}}
`;

// ── HELPERS ───────────────────────────────────────────────────
const btn = (c, sm) => ({
  fontFamily:"Orbitron,sans-serif", fontSize: sm?"0.62rem":"0.7rem", letterSpacing:"0.1em", fontWeight:700,
  padding: sm?"8px 16px":"12px 26px", borderRadius:5, border:`2px solid ${c}`, cursor:"pointer",
  textTransform:"uppercase", color:c, background:`${c}18`, transition:"all 0.16s", outline:"none",
});
const tag = c => ({
  fontFamily:"Orbitron,sans-serif", fontSize:"0.55rem", letterSpacing:"0.12em", padding:"3px 9px",
  borderRadius:3, background:`${c}18`, color:c, border:`1px solid ${c}40`,
});
const card = (bc="#1a2040", bg="#0d1020") => ({
  background:bg, border:`1px solid ${bc}`, borderRadius:8, padding:"18px 20px",
});

// ── CONFETTI ──────────────────────────────────────────────────
function Confetti({ on }) {
  const ref = useRef(); const raf = useRef();
  useEffect(() => {
    if (!on || !ref.current) return;
    const cv = ref.current, ctx = cv.getContext("2d");
    cv.width = window.innerWidth; cv.height = window.innerHeight;
    const cols = ["#00f5ff","#ff00c8","#ffe600","#00ff90","#ff6b35","#fff"];
    let ps = Array.from({length:180}, () => ({
      x:Math.random()*cv.width, y:-20, r:Math.random()*8+3,
      c:cols[~~(Math.random()*cols.length)],
      vx:(Math.random()-0.5)*5, vy:Math.random()*5+2,
      a:Math.random()*Math.PI*2, sp:(Math.random()-0.5)*0.3,
    }));
    (function draw() {
      ctx.clearRect(0,0,cv.width,cv.height);
      ps.forEach(p => { p.x+=p.vx; p.y+=p.vy; p.a+=p.sp; ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.a); ctx.fillStyle=p.c; ctx.fillRect(-p.r,-p.r/2,p.r*2,p.r); ctx.restore(); });
      ps = ps.filter(p=>p.y<cv.height+20);
      if (ps.length) raf.current = requestAnimationFrame(draw);
    })();
    return () => cancelAnimationFrame(raf.current);
  }, [on]);
  if (!on) return null;
  return <canvas ref={ref} style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:9998}} />;
}

// ── PARTICLES ────────────────────────────────────────────────
function Particles() {
  const ref = useRef(); const raf = useRef();
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext("2d");
    const resize = () => { cv.width = cv.offsetWidth; cv.height = cv.offsetHeight; };
    resize(); window.addEventListener("resize", resize);
    const ps = Array.from({length:55}, () => ({
      x:Math.random()*cv.width, y:Math.random()*cv.height,
      vx:(Math.random()-0.5)*0.35, vy:(Math.random()-0.5)*0.35, r:Math.random()*1.5+0.5,
    }));
    (function draw() {
      ctx.clearRect(0,0,cv.width,cv.height);
      ps.forEach(p => {
        p.x=(p.x+p.vx+cv.width)%cv.width; p.y=(p.y+p.vy+cv.height)%cv.height;
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fillStyle="rgba(0,245,255,0.22)"; ctx.fill();
      });
      ps.forEach((a,i) => ps.slice(i+1).forEach(b => {
        const d = Math.hypot(a.x-b.x,a.y-b.y);
        if (d<90) { ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.strokeStyle=`rgba(0,245,255,${0.07*(1-d/90)})`; ctx.lineWidth=0.7; ctx.stroke(); }
      }));
      raf.current = requestAnimationFrame(draw);
    })();
    return () => { cancelAnimationFrame(raf.current); window.removeEventListener("resize",resize); };
  }, []);
  return <canvas ref={ref} style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0,width:"100%",height:"100%"}} />;
}

// ── WHEEL ─────────────────────────────────────────────────────
const TOPICS = ["JavaScript","Operations","AI & ML","Cloud","React","Databases","Cyber Security","Git & DevOps"];
const TCOLORS = ["#00f5ff","#ff00c8","#ffe600","#00ff90","#ff6b35","#a855f7","#ec4899","#38bdf8"];

function ScorePanel({ players, onBack }) {
  const PCOLS=["#00f5ff","#ff00c8","#ffe600","#00ff90","#ff6b35","#a855f7"];
  const sorted=[...players].sort((a,b)=>b.score-a.score);
  return(
    <div style={{marginTop:24,animation:"fadeUp 0.4s ease"}}>
      <div style={{fontFamily:"Orbitron",color:"#ffe600",fontSize:"0.65rem",letterSpacing:"0.15em",marginBottom:12,textAlign:"center"}}>🏆 CURRENT SCORES</div>
      <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:20}}>
        {sorted.map((p,i)=>{
          const col=PCOLS[players.indexOf(p)%PCOLS.length];
          const medal=["🥇","🥈","🥉"][i]||"·";
          return(
            <div key={p.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",
              borderRadius:8,border:`1px solid ${i===0?"#ffe60060":"#1a2040"}`,
              background:i===0?"#ffe60010":"#0a0c18",
              animation:i===0?"winGlow 2s ease infinite":"none"}}>
              <span style={{fontSize:"1.4rem"}}>{medal}</span>
              <span style={{fontFamily:"Rajdhani",fontWeight:700,fontSize:"1rem",color:col,flex:1}}>{p.name}</span>
              <span style={{fontFamily:"Orbitron",fontSize:"1.1rem",fontWeight:900,color:i===0?"#ffe600":"#00f5ff"}}>{p.score}</span>
              <span style={{fontFamily:"Orbitron",fontSize:"0.48rem",color:"#252e60"}}>PTS</span>
            </div>
          );
        })}
      </div>
      <div style={{textAlign:"center"}}>
        <button style={{...btn("#00f5ff"),fontSize:"0.9rem",padding:"14px 40px"}} onClick={onBack}>↩ BACK TO HUB</button>
      </div>
    </div>
  );
}

function SpinWheel({ onResult }) {
  const ref = useRef(); const [spin, setSpin] = useState(false); const [res, setRes] = useState(null);
  const ang = useRef(0);

  function draw(r) {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext("2d"), W=cv.width, cx=W/2, cy=W/2, R=W/2-10;
    ctx.clearRect(0,0,W,W);
    const n=TOPICS.length, sl=(2*Math.PI)/n;
    TOPICS.forEach((t,i) => {
      const a = r+i*sl;
      ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,R,a,a+sl); ctx.closePath();
      ctx.fillStyle=TCOLORS[i]+"2a"; ctx.fill(); ctx.strokeStyle=TCOLORS[i]; ctx.lineWidth=2; ctx.stroke();
      ctx.save(); ctx.translate(cx,cy); ctx.rotate(a+sl/2);
      ctx.fillStyle=TCOLORS[i]; ctx.font=`bold 10px Orbitron,sans-serif`; ctx.textAlign="right";
      ctx.shadowColor=TCOLORS[i]; ctx.shadowBlur=6; ctx.fillText(t,R-14,4); ctx.restore();
    });
    ctx.beginPath(); ctx.arc(cx,cy,24,0,Math.PI*2); ctx.fillStyle="#07080f"; ctx.fill();
    ctx.strokeStyle="#00f5ff"; ctx.lineWidth=3; ctx.stroke();
    ctx.fillStyle="#00f5ff"; ctx.font="bold 9px Orbitron,sans-serif"; ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.shadowColor="#00f5ff"; ctx.shadowBlur=8; ctx.fillText("SPIN",cx,cy);
    ctx.beginPath(); ctx.moveTo(W-6,cy-13); ctx.lineTo(W-6,cy+13); ctx.lineTo(W-24,cy);
    ctx.closePath(); ctx.fillStyle="#ffe600"; ctx.shadowColor="#ffe600"; ctx.shadowBlur=10; ctx.fill();
  }
  useEffect(()=>{ draw(0); },[]);

  function doSpin() {
    if (spin) return; S.spin(); setSpin(true); setRes(null);
    let vel = Math.random()*0.35+0.28, raf;
    (function loop() {
      ang.current += vel; vel *= 0.984; draw(ang.current);
      if (vel > 0.005) { raf = requestAnimationFrame(loop); }
      else {
        setSpin(false);
        const n=TOPICS.length, sl=(2*Math.PI)/n;
        const norm = ((2*Math.PI)-(ang.current%(2*Math.PI)))%(2*Math.PI);
        const idx = ~~(norm/sl)%n;
        setRes(TOPICS[idx]); S.fanfare();
        setTimeout(() => onResult(TOPICS[idx]), 1100);
      }
    })();
  }

  return (
    <div style={{textAlign:"center"}}>
      <div style={{display:"inline-block",cursor:spin?"wait":"pointer",filter:"drop-shadow(0 0 24px #00f5ff30)"}} onClick={doSpin}>
        <canvas ref={ref} width={260} height={260} />
      </div>
      {res && <div style={{fontFamily:"Orbitron",color:"#ffe600",fontSize:"1rem",marginTop:10,textShadow:"0 0 12px #ffe600",animation:"pop 0.4s ease"}}>🎯 {res}</div>}
      {!spin&&!res&&<div style={{fontFamily:"Orbitron",color:"#252e60",fontSize:"0.62rem",marginTop:10,letterSpacing:"0.1em"}}>CLICK WHEEL TO SPIN CATEGORY</div>}
      {spin&&<div style={{fontFamily:"Orbitron",color:"#00f5ff",fontSize:"0.62rem",marginTop:10,letterSpacing:"0.1em",animation:"blink 0.5s infinite"}}>SPINNING…</div>}
    </div>
  );
}

// ── TYPING TEXT ───────────────────────────────────────────────
function Type({ text, speed=20, style }) {
  const [s, setS] = useState("");
  useEffect(()=>{ setS(""); let i=0; const t=setInterval(()=>{ i++; setS(text.slice(0,i)); if(i>=text.length)clearInterval(t); },speed); return()=>clearInterval(t); },[text]);
  return <span style={style}>{s}<span style={{animation:"blink 0.7s infinite",opacity:0.5}}>|</span></span>;
}

// ── SCORE COUNTER ─────────────────────────────────────────────
function Count({ to, dur=1200 }) {
  const [v,setV]=useState(0);
  useEffect(()=>{
    let t0=null;
    (function step(ts){ if(!t0)t0=ts; const p=Math.min((ts-t0)/dur,1); setV(~~(p*to)); if(p<1)requestAnimationFrame(step); })(performance.now());
  },[to]);
  return <>{v}</>;
}

// ── CIRCLE TIMER ──────────────────────────────────────────────
function CTimer({ v, max=20 }) {
  const r=26, c=2*Math.PI*r, col=v<=5?"#ff4060":v<=10?"#ffe600":"#00f5ff";
  return (
    <div style={{position:"relative",width:64,height:64,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <svg width="64" height="64" style={{position:"absolute",transform:"rotate(-90deg)"}}>
        <circle cx="32" cy="32" r={r} fill="none" stroke="#1a2040" strokeWidth="4"/>
        <circle cx="32" cy="32" r={r} fill="none" stroke={col} strokeWidth="4"
          strokeDasharray={c} strokeDashoffset={c*(1-v/max)}
          style={{transition:"stroke-dashoffset 1s linear,stroke 0.5s",filter:`drop-shadow(0 0 5px ${col})`}}/>
      </svg>
      <div style={{fontFamily:"Orbitron",fontSize:"1.25rem",fontWeight:900,color:col,
        textShadow:`0 0 10px ${col}`,animation:v<=5?"pulse 0.5s infinite":"none"}}>{v}</div>
    </div>
  );
}

// ── PODIUM ────────────────────────────────────────────────────
function Podium({ players }) {
  const sorted=[...players].sort((a,b)=>b.score-a.score);
  const top=sorted.slice(0,3);
  const medals=["🥇","🥈","🥉"];
  const cols=["#ffe600","#c0c0c0","#cd7f32"];
  const hs=[150,110,80];
  const labels=["1ST","2ND","3RD"];
  const order=[top[1],top[0],top[2]]; // 2nd left, 1st centre, 3rd right
  const orderIdx=[1,0,2];
  const [step,setStep]=useState(0); // 0=intro,1=show3rd,2=show2nd,3=show1st,4=done
  const [fireworks,setFireworks]=useState([]);

  useEffect(()=>{
    const timers=[
      setTimeout(()=>setStep(1),800),
      setTimeout(()=>{ setStep(2); S.swoosh(); },2200),
      setTimeout(()=>{ setStep(3); S.fanfare(); },4000),
      setTimeout(()=>{
        setStep(4); S.fanfare();
        setFireworks([...Array(18)].map((_,i)=>({id:i,x:Math.random()*100,y:Math.random()*60+10,c:["#ffe600","#ff00c8","#00f5ff","#00ff90"][i%4]})));
        setTimeout(()=>setFireworks([]),3000);
      },6000),
    ];
    return ()=>timers.forEach(clearTimeout);
  },[]);

  return(
    <div style={{textAlign:"center",padding:"10px 0",minHeight:400,position:"relative",overflow:"hidden"}}>
      {/* Fireworks */}
      {fireworks.map(f=>(
        <div key={f.id} style={{position:"absolute",left:`${f.x}%`,top:`${f.y}%`,
          width:8,height:8,borderRadius:"50%",background:f.c,
          boxShadow:`0 0 12px ${f.c},0 0 30px ${f.c}`,
          animation:"pop 0.5s ease forwards",pointerEvents:"none",zIndex:100}}/>
      ))}

      {/* Title */}
      <div style={{fontFamily:"Orbitron",fontWeight:900,fontSize:"1.7rem",
        color:"#ffe600",textShadow:"0 0 30px #ffe600,0 0 70px #ffe60050",
        marginBottom:4,animation:"float 2s ease-in-out infinite",
        opacity:step>=1?1:0,transform:step>=1?"scale(1)":"scale(0.7)",transition:"all 0.6s cubic-bezier(0.34,1.56,0.64,1)"}}>
        🏆 FINAL RESULTS
      </div>
      <div style={{fontFamily:"Orbitron",color:"#1e2848",fontSize:"0.55rem",letterSpacing:"0.2em",marginBottom:32,
        opacity:step>=1?1:0,transition:"opacity 0.8s 0.3s"}}>
        CHITTI TECH ARENA · ANNUAL FUNCTION · AI GAME SHOW
      </div>

      {/* Podium */}
      <div style={{display:"flex",alignItems:"flex-end",justifyContent:"center",gap:16,marginBottom:24}}>
        {order.map((p,i)=>{
          const realIdx=orderIdx[i];
          const visible=(realIdx===2&&step>=1)||(realIdx===1&&step>=2)||(realIdx===0&&step>=3);
          if(!p) return <div key={i} style={{width:110}}/>;
          return(
            <div key={p.id} style={{width:110,textAlign:"center",
              opacity:visible?1:0,transform:visible?"translateY(0)":"translateY(80px)",
              transition:`all 0.8s cubic-bezier(0.34,1.56,0.64,1)`}}>
              {/* Spotlight for 1st */}
              {realIdx===0&&step>=3&&(
                <div style={{position:"absolute",left:"50%",top:0,transform:"translateX(-50%)",
                  width:180,height:300,background:"radial-gradient(ellipse,#ffe60020 0%,transparent 70%)",
                  pointerEvents:"none",zIndex:0}}/>
              )}
              <div style={{fontSize:"2.6rem",marginBottom:6,
                animation:realIdx===0&&step>=4?`float 1.5s ease-in-out infinite`:`float ${2.5+i*0.3}s ease-in-out infinite`,
                filter:realIdx===0&&step>=4?"drop-shadow(0 0 14px #ffe600)":"none"}}>
                {medals[realIdx]}
              </div>
              <div style={{fontFamily:"Orbitron",fontWeight:900,fontSize:"0.78rem",marginBottom:4,
                color:cols[realIdx],textShadow:realIdx===0&&step>=3?`0 0 20px ${cols[realIdx]}`:""}}>{p.name}</div>
              <div style={{fontFamily:"Orbitron",color:cols[realIdx],fontSize:"1.05rem",marginBottom:10,
                textShadow:`0 0 12px ${cols[realIdx]}80`}}>
                <Count to={p.score}/>
              </div>
              <div style={{height:hs[realIdx],borderRadius:"8px 8px 0 0",
                background:`linear-gradient(180deg,${cols[realIdx]}40,${cols[realIdx]}10)`,
                border:`2px solid ${cols[realIdx]}`,borderBottom:"none",
                boxShadow:`0 0 28px ${cols[realIdx]}50,inset 0 0 20px ${cols[realIdx]}10`,
                display:"flex",alignItems:"flex-start",justifyContent:"center",paddingTop:12,
                fontFamily:"Orbitron",fontSize:"0.58rem",color:cols[realIdx],letterSpacing:"0.1em",fontWeight:700}}>
                {labels[realIdx]}
              </div>
            </div>
          );
        })}
      </div>

      {/* Dramatic 1st place banner */}
      {step>=4&&top[0]&&(
        <div style={{marginBottom:16,padding:"12px 20px",
          background:"linear-gradient(135deg,#ffe60025,#ff00c815,#ffe60025)",
          border:"2px solid #ffe600",borderRadius:10,
          boxShadow:"0 0 40px #ffe60050",animation:"pop 0.6s cubic-bezier(0.34,1.56,0.64,1)"}}>
          <div style={{fontFamily:"Orbitron",fontSize:"0.5rem",color:"#ffe600",letterSpacing:"0.2em",marginBottom:4}}>🎉 WINNER</div>
          <div style={{fontFamily:"Orbitron",fontWeight:900,fontSize:"1.4rem",color:"#ffe600",
            textShadow:"0 0 20px #ffe600"}}>{top[0].name}</div>
          <div style={{fontFamily:"Orbitron",color:"#00f5ff",fontSize:"0.7rem",marginTop:4}}>{top[0].score} POINTS</div>
        </div>
      )}

      {/* Others */}
      {step>=4&&sorted.slice(3).map((p,i)=>(
        <div key={p.id} style={{display:"inline-flex",gap:8,margin:"3px 8px",
          fontFamily:"Orbitron",fontSize:"0.58rem",color:"#252e60"}}>
          #{i+4} {p.name} — {p.score}
        </div>
      ))}
    </div>
  );
}

// ── TEAM INTRO COMPONENT ─────────────────────────────────────
function TeamIntro({ players, onDone }) {
  const PCOLS=["#00f5ff","#ff00c8","#ffe600","#00ff90","#ff6b35","#a855f7"];
  const pList=players&&players.length>=1?players:[{id:1,name:"Team"}];
  const [phase,setPhase]=useState("ready"); // ready|showing|done
  const [idx,setIdx]=useState(0);
  const [timer,setTimer]=useState(5);
  const [visible,setVisible]=useState(false);

  function startIntro(){setPhase("showing");setIdx(0);setTimer(5);setVisible(false);setTimeout(()=>setVisible(true),100);}

  useEffect(()=>{
    if(phase!=="showing")return;
    S.swoosh(); setVisible(false); setTimeout(()=>setVisible(true),80);
    const t=setInterval(()=>{
      setTimer(tm=>{
        if(tm<=1){
          clearInterval(t);
          if(idx+1>=pList.length){setPhase("done");}
          else{setIdx(i=>i+1);setTimer(5);}
          return 5;
        }
        if(tm<=3)S.tick();
        return tm-1;
      });
    },1000);
    return()=>clearInterval(t);
  },[idx,phase]);

  const p=pList[idx]; const col=p?PCOLS[idx%PCOLS.length]:"#00f5ff";

  if(phase==="done") return(
    <div style={{textAlign:"center",padding:"60px 0"}}>
      <div style={{fontSize:"3rem",marginBottom:16,animation:"float 2s ease-in-out infinite"}}>🎉</div>
      <div style={{fontFamily:"Orbitron",fontWeight:900,fontSize:"1.3rem",color:"#00ff90",textShadow:"0 0 20px #00ff90",marginBottom:10}}>ALL TEAMS READY!</div>
      <div style={{color:"#252e60",fontFamily:"Rajdhani",marginBottom:28}}>Let the games begin!</div>
      <button style={{...btn("#00ff90"),fontSize:"0.9rem",padding:"16px 40px"}} onClick={onDone}>🚀 START GAME</button>
    </div>
  );

  if(phase==="ready") return(
    <div style={{textAlign:"center",padding:"40px 0"}}>
      <div style={{fontFamily:"Orbitron",color:"#00f5ff",fontSize:"0.78rem",letterSpacing:"0.2em",marginBottom:20}}>🎬 TEAM SPOTLIGHTS</div>
      <div style={{color:"#252e60",fontFamily:"Rajdhani",fontSize:"1rem",marginBottom:30}}>Each team gets 5 seconds in the spotlight</div>
      <div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap",marginBottom:30}}>
        {pList.map((p,i)=>(
          <div key={p.id} style={{padding:"8px 18px",borderRadius:8,border:`1.5px solid ${PCOLS[i%PCOLS.length]}`,
            fontFamily:"Orbitron",fontSize:"0.65rem",color:PCOLS[i%PCOLS.length]}}>
            {p.name}
          </div>
        ))}
      </div>
      <button style={{...btn("#00f5ff"),fontSize:"0.9rem",padding:"16px 40px"}} onClick={startIntro}>🎬 BEGIN INTROS</button>
    </div>
  );

  return(
    <div style={{minHeight:360,display:"flex",flexDirection:"column",alignItems:"center",
      justifyContent:"center",position:"relative",overflow:"hidden",padding:"20px"}}>
      {/* Background glow */}
      <div style={{position:"absolute",inset:0,background:`radial-gradient(ellipse at center,${col}18 0%,transparent 70%)`,
        transition:"background 0.5s",pointerEvents:"none"}}/>
      {/* Team number */}
      <div style={{fontFamily:"Orbitron",fontSize:"0.55rem",color:col,letterSpacing:"0.25em",marginBottom:18,
        opacity:visible?1:0,transform:visible?"translateY(0)":"translateY(20px)",transition:"all 0.5s ease"}}>
        TEAM {idx+1} OF {pList.length}
      </div>
      {/* Big team name */}
      <div style={{fontFamily:"Orbitron",fontWeight:900,
        fontSize:p&&p.name.length>10?"1.8rem":"2.4rem",
        color:col,textShadow:`0 0 40px ${col},0 0 80px ${col}60`,
        textAlign:"center",letterSpacing:"0.05em",
        opacity:visible?1:0,
        transform:visible?"translateY(0) scale(1)":"translateY(60px) scale(0.8)",
        transition:"all 0.6s cubic-bezier(0.34,1.56,0.64,1) 0.05s",
        marginBottom:24}}>
        {p?p.name:""}
      </div>
      {/* Score badge */}
      {p&&p.score>0&&(
        <div style={{fontFamily:"Orbitron",color:col,fontSize:"0.7rem",letterSpacing:"0.1em",
          background:`${col}15`,border:`1px solid ${col}40`,borderRadius:6,padding:"4px 14px",
          marginBottom:20,opacity:visible?1:0,transition:"opacity 0.5s 0.3s"}}>
          {p.score} PTS
        </div>
      )}
      {/* Countdown ring */}
      <div style={{position:"relative",width:80,height:80,
        opacity:visible?1:0,transition:"opacity 0.4s 0.2s"}}>
        <svg width="80" height="80" style={{transform:"rotate(-90deg)"}}>
          <circle cx="40" cy="40" r="32" fill="none" stroke={`${col}25`} strokeWidth="4"/>
          <circle cx="40" cy="40" r="32" fill="none" stroke={col} strokeWidth="4"
            strokeDasharray={`${2*Math.PI*32}`}
            strokeDashoffset={`${2*Math.PI*32*(1-timer/5)}`}
            style={{transition:"stroke-dashoffset 0.9s linear"}}/>
        </svg>
        <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",
          fontFamily:"Orbitron",fontWeight:900,fontSize:"1.6rem",color:col}}>{timer}</div>
      </div>
      {/* Progress dots */}
      <div style={{display:"flex",gap:8,marginTop:24}}>
        {pList.map((_,i)=>(
          <div key={i} style={{width:i===idx?22:8,height:8,borderRadius:4,
            background:i===idx?col:i<idx?col+"60":"#1a2040",
            transition:"all 0.4s ease"}}/>
        ))}
      </div>
    </div>
  );
}

// ── QUIZ GAME ─────────────────────────────────────────────────
const HUMAN_QUESTIONS = {
  "JavaScript": {question:"What does typeof null return in JavaScript?",options:["A. null","B. undefined","C. object","D. string"],correct:2,explanation:"typeof null returns 'object' — a famous JS bug kept for compatibility.",fun_fact:"Brendan Eich created JavaScript in just 10 days in 1995!"},
};

function QuizGame({ players, onAddScore, onDone }) {
  const pList=players&&players.length>=1?players:[{id:1,name:"Team"}];
  const PCOLS=["#00f5ff","#ff00c8","#ffe600","#00ff90","#ff6b35","#a855f7"];
  const [phase,setPhase]=useState("wheel");
  const [topic,setTopic]=useState(null);
  const [qData,setQData]=useState(null);
  const [teamVotes,setTeamVotes]=useState({}); // { teamId: optionIndex }
  const [revealed,setRevealed]=useState(false);
  const [timer,setTimer]=useState(20);
  const [qNum,setQNum]=useState(1);
  const [streak,setStreak]=useState(0);
  const [confetti,setConfetti]=useState(false);
  const [elim,setElim]=useState([]);
  const [ll,setLL]=useState({fifty:true,audience:true});
  const [audData,setAudData]=useState(null);
  const [cd,setCd]=useState(3);
  const tref=useRef(); const queueRef=useRef(null); const timerRef=useRef(20); const TOTAL=10;

  function loadQ(top){
    setPhase("loading"); setTeamVotes({}); setRevealed(false); setElim([]); setAudData(null); timerRef.current=20;
    if(!queueRef.current||queueRef.current.topic!==top){
      queueRef.current={topic:top,queue:shuffle(QUIZ_BANK[top]||QUIZ_BANK["JavaScript"])};
    }
    const q=queueRef.current.queue.pop()||(QUIZ_BANK[top]||QUIZ_BANK["JavaScript"])[0];
    setQData(q);
    setPhase("countdown"); setCd(3);
    let c=3;
    const ct=setInterval(()=>{ c--; setCd(c); S.tick(); if(c<=0){clearInterval(ct);setPhase("question");setTimer(20);} },1000);
  }

  useEffect(()=>{
    if(phase!=="question") return;
    tref.current=setInterval(()=>{
      setTimer(t=>{ const nt=t-1; timerRef.current=nt; if(t<=5)S.tick(); if(t<=1){clearInterval(tref.current);doReveal();return 0;} return nt; });
    },1000);
    return()=>clearInterval(tref.current);
  },[phase]);

  function setTeamVote(teamId,optIdx){
    if(revealed||phase!=="question") return;
    setTeamVotes(v=>({...v,[teamId]:optIdx}));
  }

  function doReveal(){
    clearInterval(tref.current); setRevealed(true); setPhase("reveal");
    const t=timerRef.current;
    let anyCorrect=false;
    pList.forEach((p,i)=>{
      if(teamVotes[p.id]===qData.correct){ onAddScore(50,i); anyCorrect=true; }
      else if(teamVotes[p.id]!==undefined){ onAddScore(-10,i); }
    });
    if(anyCorrect){S.correct();setStreak(s=>s+1);setConfetti(true);setTimeout(()=>setConfetti(false),2500);}
    else{S.wrong();setStreak(0);}
  }

  // auto-reveal when all teams have voted
  useEffect(()=>{
    if(phase!=="question"||revealed) return;
    if(pList.length>0&&pList.every(p=>teamVotes[p.id]!==undefined)){
      doReveal();
    }
  },[teamVotes,phase,revealed]);

  function lifeline(type){
    S.lifeline();
    if(type==="fifty"&&ll.fifty){
      const wrong=qData.options.map((_,i)=>i).filter(i=>i!==qData.correct);
      setElim(wrong.sort(()=>Math.random()-0.5).slice(0,2)); setLL(l=>({...l,fifty:false}));
    }
    if(type==="audience"&&ll.audience&&!audData){
      const cp=~~(Math.random()*25)+45;
      const oth=[~~(Math.random()*20),~~(Math.random()*15),~~(Math.random()*10)];
      const adj=100-cp-oth.reduce((a,b)=>a+b,0);
      const d=[0,0,0,0]; d[qData.correct]=cp;
      let j=0; d.forEach((_,i)=>{ if(i!==qData.correct){d[i]=oth[j]+(j===oth.length-1?adj:0);j++;} });
      setAudData(d); setLL(l=>({...l,audience:false}));
    }
  }

  if(phase==="done") return(
    <div style={{padding:"20px 0"}}>
      <div style={{textAlign:"center",marginBottom:8}}>
        <div style={{fontSize:"2.5rem",marginBottom:6}}>🎯</div>
        <div style={{fontFamily:"Orbitron",color:"#00ff90",fontSize:"1.2rem",textShadow:"0 0 14px #00ff90"}}>Quiz Complete!</div>
        <div style={{color:"#3040a0",fontFamily:"Rajdhani",marginTop:4,fontSize:"0.9rem"}}>All {TOTAL} {topic} questions answered</div>
      </div>
      <ScorePanel players={pList} onBack={onDone}/>
    </div>
  );

  return(
    <div>
      <Confetti on={confetti}/>
      {phase==="wheel"&&(
        <div style={{textAlign:"center"}}>
          <div style={{fontFamily:"Orbitron",color:"#00f5ff",fontSize:"0.75rem",letterSpacing:"0.15em",marginBottom:20}}>SPIN TO SELECT YOUR CATEGORY</div>
          <SpinWheel onResult={t=>{setTopic(t);loadQ(t);}}/>
        </div>
      )}
      {phase==="loading"&&(
        <div style={{textAlign:"center",padding:"64px 0"}}>
          <div style={{width:44,height:44,border:"3px solid #1a2040",borderTopColor:"#00f5ff",borderRadius:"50%",animation:"spin 0.8s linear infinite",margin:"0 auto 18px"}}></div>
          <div style={{fontFamily:"Orbitron",color:"#252e60",fontSize:"0.68rem",letterSpacing:"0.14em"}}>AI CRAFTING QUESTION {qNum}/{TOTAL}…</div>
        </div>
      )}
      {phase==="countdown"&&(
        <div style={{textAlign:"center",padding:"60px 0"}}>
          <div style={{fontFamily:"Orbitron",color:"#ffe600",fontSize:"7rem",fontWeight:900,textShadow:"0 0 50px #ffe600",animation:"pop 0.3s ease"}}>{cd||"GO!"}</div>
          <div style={{fontFamily:"Orbitron",color:"#252e60",fontSize:"0.65rem",letterSpacing:"0.2em",marginTop:10}}>GET READY…</div>
        </div>
      )}
      {(phase==="question"||phase==="reveal")&&qData&&(
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
              <span style={tag("#00f5ff")}>{topic}</span>
              <span style={tag(qNum<=2?"#00ff90":qNum<=4?"#ffe600":"#ff4060")}>{qNum<=2?"EASY":qNum<=4?"MEDIUM":"HARD"}</span>
              {streak>=2&&<span style={{...tag("#ffe600"),animation:"glowPulse 1s ease infinite"}}>🔥 ×{streak} STREAK</span>}
            </div>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <span style={{fontFamily:"Orbitron",color:"#252e60",fontSize:"0.62rem"}}>Q{qNum}/{TOTAL}</span>
              {phase==="question"&&<CTimer v={timer}/>}
            </div>
          </div>
          {/* Lifelines */}
          {phase==="question"&&(
            <div style={{display:"flex",gap:8,marginBottom:14}}>
              <button onClick={()=>lifeline("fifty")} disabled={!ll.fifty||elim.length>0}
                style={{...btn("#ffe600",true),opacity:ll.fifty?1:0.3,fontSize:"0.58rem"}}>50 : 50</button>
              <button onClick={()=>lifeline("audience")} disabled={!ll.audience||!!audData}
                style={{...btn("#ff00c8",true),opacity:ll.audience?1:0.3,fontSize:"0.58rem"}}>📊 ASK AUDIENCE</button>
              <span style={{marginLeft:"auto",fontFamily:"Orbitron",color:"#1a2040",fontSize:"0.55rem",alignSelf:"center"}}>LIFELINES</span>
            </div>
          )}
          {/* Question card */}
          <div style={{...card("#00f5ff22"),marginBottom:16,position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse at top left,#00f5ff06,transparent 65%)",pointerEvents:"none"}}/>
            <div style={{fontSize:"1.1rem",fontWeight:600,lineHeight:1.65,fontFamily:"Rajdhani"}}>{qData.question}</div>
          </div>
          {/* Options grid */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:11,marginBottom:18}}>
            {qData.options?.map((opt,i)=>{
              const isE=elim.includes(i);
              let bc="#1a2040",bg="#0d1020",col="#8090b0";
              if(phase==="reveal"){ if(i===qData.correct){bc="#00ff90";bg="#00ff9018";col="#00ff90";} }
              return(
                <div key={i}>
                  <div style={{width:"100%",padding:"12px 14px",borderRadius:6,border:`2px solid ${isE?"#1a2040":bc}`,
                    background:isE?"#070910":bg,color:isE?"#1a2040":col,
                    fontFamily:"Rajdhani",fontSize:"1rem",fontWeight:600,textAlign:"left",
                    boxShadow:phase==="reveal"&&i===qData.correct?"0 0 22px #00ff9050":"none"}}>
                    <span style={{opacity:0.38,marginRight:8,fontFamily:"Orbitron",fontSize:"0.6rem"}}>{"ABCD"[i]}</span>
                    {isE?"✗":opt.replace(/^[A-D]\.\s*/,"")}
                  </div>
                  {audData&&!isE&&(
                    <div>
                      <div style={{height:5,borderRadius:3,background:"#1a2040",overflow:"hidden",marginTop:4}}>
                        <div style={{height:"100%",borderRadius:3,background:i===qData.correct?"#00ff90":"#3a4060",width:audData[i]+"%",transition:"width 1s ease"}}/>
                      </div>
                      <div style={{fontFamily:"Orbitron",fontSize:"0.5rem",color:"#252e60",marginTop:2}}>{audData[i]}% voted</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {/* Per-team answer selection */}
          {phase==="question"&&(
            <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:14}}>
              <div style={{fontFamily:"Orbitron",fontSize:"0.52rem",color:"#252e60",letterSpacing:"0.12em",marginBottom:2}}>TEAM ANSWERS:</div>
              {pList.map((p,pi)=>{
                const col=PCOLS[pi%PCOLS.length];
                const voted=teamVotes[p.id];
                return(
                  <div key={p.id} style={{display:"flex",alignItems:"center",gap:6,padding:"8px 12px",
                    borderRadius:8,border:`1px solid ${voted!==undefined?col+"60":"#1a2040"}`,background:"#0a0c18",flexWrap:"wrap"}}>
                    <span style={{fontFamily:"Orbitron",fontSize:"0.55rem",color:col,flex:"0 0 90px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</span>
                    {qData.options?.map((_,oi)=>{
                      const isE=elim.includes(oi);
                      if(isE) return null;
                      const active=voted===oi;
                      return(
                        <button key={oi} onClick={()=>setTeamVote(p.id,oi)}
                          style={{fontFamily:"Orbitron",fontSize:"0.55rem",padding:"5px 12px",borderRadius:4,
                            border:`1px solid ${active?col:"#1a2040"}`,
                            background:active?col+"20":"transparent",
                            color:active?col:"#3a4570",cursor:"pointer",transition:"all 0.15s",
                            boxShadow:active?`0 0 8px ${col}40`:"none"}}>
                          {"ABCD"[oi]}
                        </button>
                      );
                    })}
                    {voted!==undefined&&<span style={{color:col,fontSize:"0.75rem",marginLeft:"auto"}}>✓</span>}
                  </div>
                );
              })}
              {pList.every(p=>teamVotes[p.id]!==undefined)&&(
                <div style={{textAlign:"center",marginTop:4}}>
                  <button style={{...btn("#ffe600"),fontSize:"0.9rem",padding:"12px 36px"}} onClick={doReveal}>⚡ REVEAL!</button>
                </div>
              )}
            </div>
          )}
          {/* Reveal box */}
          {phase==="reveal"&&(
            <div>
              {/* Per-team result rows */}
              <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:14}}>
                {pList.map((p,pi)=>{
                  const col=PCOLS[pi%PCOLS.length];
                  const voted=teamVotes[p.id];
                  const correct=voted===qData.correct;
                  return(
                    <div key={p.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 14px",
                      borderRadius:8,border:`1px solid ${correct?"#00ff9060":"#ff406040"}`,
                      background:correct?"#00ff9008":"#ff406008"}}>
                      <span style={{fontFamily:"Orbitron",fontSize:"0.58rem",color:col,flex:"0 0 90px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</span>
                      <span style={{fontFamily:"Orbitron",fontSize:"0.62rem",color:correct?"#00ff90":"#ff4060",flex:1}}>
                        {voted!==undefined?`${["A","B","C","D"][voted]} — `:"No answer — "}
                        {correct?"✓":"✗"}
                      </span>
                      <span style={{fontFamily:"Orbitron",fontSize:"0.62rem",fontWeight:900,color:correct?"#00ff90":"#ff4060"}}>
                        {voted!==undefined?(correct?"+50 pts":"-10 pts"):"0 pts"}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div style={{...card("#00f5ff15"),marginBottom:10}}>
                <div style={{color:"#00ff90",fontWeight:700,fontSize:"0.95rem",marginBottom:6}}>
                  ✓ Answer: {qData.options?.[qData.correct]?.replace(/^[A-D]\.\s*/,"")}
                </div>
                <div style={{color:"#3040a0",fontSize:"0.85rem",marginBottom:8}}>{qData.explanation}</div>
                {qData.fun_fact&&<div style={{color:"#3a4570",fontSize:"0.82rem",borderTop:"1px solid #1a2040",paddingTop:10}}>💡 {qData.fun_fact}</div>}
              </div>
              <div style={{textAlign:"right",marginTop:14}}>
                <button style={btn("#00f5ff",true)} onClick={()=>{ if(qNum>=TOTAL)setPhase("done"); else{setQNum(n=>n+1);loadQ(topic);} }}>
                  {qNum>=TOTAL?"🎉 Finish":"Next →"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── AI OR HUMAN ───────────────────────────────────────────────

function AiOrHuman({ players, onAddScore, onDone }) {
  const PCOLS=["#00f5ff","#ff00c8","#ffe600","#00ff90","#ff6b35","#a855f7"];
  const pList=players&&players.length>=1?players:[{id:1,name:"Team"}];
  const [phase,setPhase]=useState("loading");
  const [sample,setSample]=useState(null);
  const [votes,setVotes]=useState({});   // { teamId: true/false }
  const [round,setRound]=useState(1);
  const [confetti,setConfetti]=useState(false);
  const [rcd,setRcd]=useState(null);
  const TOTAL=10;
  const queueRef=useRef(null);

  function load(){
    setPhase("loading"); setVotes({}); setRcd(null);
    if(!queueRef.current||queueRef.current.length===0) queueRef.current=shuffle([...AH_BANK]);
    const s=queueRef.current.pop();
    setSample(s);
    setPhase("question");
  }
  useEffect(()=>{load();},[round]);

  function setTeamVote(teamId,val){setVotes(v=>({...v,[teamId]:val}));}

  function startReveal(){
    S.tick(); let c=3; setRcd(c);
    const t=setInterval(()=>{ c--; setRcd(c); S.tick(); if(c<=0){
      clearInterval(t); setRcd(null); setPhase("reveal");
      let any=false;
      pList.forEach((p,i)=>{ if(votes[p.id]===sample.isAI){onAddScore(50,i);any=true;} else if(votes[p.id]!==undefined){onAddScore(-10,i);} });
      if(any){S.correct();setConfetti(true);setTimeout(()=>setConfetti(false),2500);}
      else S.wrong();
    }},1000);
  }

  if(phase==="done") return(
    <div style={{padding:"20px 0"}}>
      <div style={{textAlign:"center",marginBottom:8}}>
        <div style={{fontSize:"2.5rem",marginBottom:6}}>🤖</div>
        <div style={{fontFamily:"Orbitron",color:"#ff00c8",fontSize:"1.2rem",textShadow:"0 0 14px #ff00c8"}}>Round Over!</div>
      </div>
      <ScorePanel players={pList} onBack={onDone}/>
    </div>
  );

  return(
    <div>
      <Confetti on={confetti}/>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <div style={{fontFamily:"Orbitron",color:"#ff00c8",fontSize:"0.9rem",textShadow:"0 0 10px #ff00c8"}}>🤖 AI or Human?</div>
        <span style={{fontFamily:"Orbitron",color:"#252e60",fontSize:"0.65rem"}}>Round {round}/{TOTAL}</span>
      </div>
      {phase==="loading"&&<div style={{textAlign:"center",padding:"60px 0"}}>
        <div style={{width:40,height:40,border:"3px solid #1a2040",borderTopColor:"#ff00c8",borderRadius:"50%",animation:"spin 0.8s linear infinite",margin:"0 auto 16px"}}/>
        <div style={{fontFamily:"Orbitron",color:"#252e60",fontSize:"0.68rem",letterSpacing:"0.14em"}}>GENERATING SAMPLE…</div>
      </div>}
      {(phase==="question"||phase==="reveal")&&sample&&(
        <>
          <div style={{...card("#ff00c822"),marginBottom:18}}>
            <div style={{color:"#252e60",fontSize:"0.58rem",fontFamily:"Orbitron",letterSpacing:"0.12em",marginBottom:8}}>QUESTION:</div>
            <div style={{color:"#5060a0",fontSize:"0.95rem",marginBottom:14,fontStyle:"italic"}}>"{sample.prompt}"</div>
            <div style={{color:"#252e60",fontSize:"0.58rem",fontFamily:"Orbitron",letterSpacing:"0.12em",marginBottom:10}}>RESPONSE:</div>
            <div style={{fontSize:"1.08rem",lineHeight:1.75,color:"#d0deff",fontStyle:"italic",borderLeft:"3px solid #ff00c840",paddingLeft:16}}>
              {phase==="question"?<Type text={`"${sample.text}"`} speed={18}/>:`"${sample.text}"`}
            </div>
          </div>
          {rcd!==null&&(
            <div style={{textAlign:"center",padding:"18px 0"}}>
              <div style={{fontFamily:"Orbitron",color:"#ffe600",fontSize:"6rem",fontWeight:900,textShadow:"0 0 40px #ffe600",animation:"pop 0.3s ease"}}>{rcd||"REVEAL!"}</div>
            </div>
          )}
          {phase==="question"&&rcd===null&&(
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {pList.map((p,i)=>{
                const col=PCOLS[i%PCOLS.length];
                const voted=votes[p.id];
                return(
                  <div key={p.id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",
                    borderRadius:8,border:`1px solid ${voted!==undefined?col+"60":"#1a2040"}`,background:"#0a0c18"}}>
                    <span style={{fontFamily:"Orbitron",fontSize:"0.58rem",color:col,flex:"0 0 110px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</span>
                    <button onClick={()=>setTeamVote(p.id,true)}
                      style={{...btn("#00f5ff",voted===true),fontSize:"0.62rem",padding:"6px 14px"}}>🤖 AI</button>
                    <button onClick={()=>setTeamVote(p.id,false)}
                      style={{...btn("#ff00c8",voted===false),fontSize:"0.62rem",padding:"6px 14px"}}>👤 Human</button>
                    {voted!==undefined&&<span style={{color:col,fontSize:"0.7rem"}}>✓</span>}
                  </div>
                );
              })}
              {Object.keys(votes).length===pList.length&&(
                <div style={{textAlign:"center",marginTop:8}}>
                  <button style={{...btn("#ffe600"),fontSize:"0.9rem",padding:"14px 40px"}} onClick={startReveal}>⚡ REVEAL!</button>
                </div>
              )}
            </div>
          )}
          {phase==="reveal"&&(
            <div style={{animation:"pop 0.5s cubic-bezier(0.34,1.56,0.64,1)"}}>
              <div style={{...card("#ff00c822"),padding:"18px 20px",marginBottom:14,textAlign:"center"}}>
                <div style={{fontFamily:"Orbitron",color:sample.isAI?"#00f5ff":"#ff00c8",fontSize:"1.1rem",marginBottom:8}}>
                  Written by {sample.isAI?"🤖 Claude AI":"👤 a Human"}
                </div>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
                {pList.map((p,i)=>{
                  const col=PCOLS[i%PCOLS.length];
                  const correct=votes[p.id]===sample.isAI;
                  return(
                    <div key={p.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",
                      borderRadius:8,border:`1px solid ${correct?"#00ff9040":"#ff406040"}`,
                      background:correct?"#00ff9010":"#ff406010"}}>
                      <span style={{fontSize:"1.2rem"}}>{correct?"✅":"❌"}</span>
                      <span style={{fontFamily:"Orbitron",fontSize:"0.6rem",color:col,flex:1}}>{p.name}</span>
                      <span style={{fontFamily:"Orbitron",fontSize:"0.58rem",color:correct?"#00ff90":"#ff4060"}}>
                        {correct?"+50 pts":"-10 pts"}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div style={{textAlign:"center"}}>
                <button style={btn("#ff00c8")} onClick={()=>{if(round>=TOTAL)setPhase("done");else setRound(r=>r+1);}}>
                  {round>=TOTAL?"🎉 Finish":"Next Round →"}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── PROMPT BATTLE ─────────────────────────────────────────────
const BATTLES=[
  {task:"Write the most creative tech startup pitch in ONE sentence",icon:"🚀"},
  {task:"Explain Machine Learning using ONLY a food analogy",icon:"🍕"},
  {task:"Write the funniest one-liner about debugging code",icon:"😂"},
  {task:"Hype CHITTI TECH ARENA annual function in under 20 words",icon:"🎉"},
  {task:"Explain the internet to someone from the 1800s in 2 sentences",icon:"🕰️"},
  {task:"Write a job description for an AI that replaces you",icon:"🤖"},
  {task:"Describe your coding style using only movie titles",icon:"🎬"},
  {task:"Convince someone that Python is better than JavaScript (or vice versa)",icon:"⚔️"},
  {task:"Write a horror story about a production server going down in 3 sentences",icon:"😱"},
  {task:"Explain what a bug is using a cooking disaster analogy",icon:"🍳"},
  {task:"Write the worst possible variable name and defend it",icon:"💀"},
  {task:"Pitch 'Git' to someone who has never heard of version control",icon:"📝"},
  {task:"Write a motivational speech for a developer with imposter syndrome",icon:"💪"},
  {task:"Describe a senior developer vs junior developer using animals",icon:"🐘"},
  {task:"Write a breakup letter from a developer to their old tech stack",icon:"💔"},
  {task:"Explain recursion using a real-life scenario (no code!)",icon:"🔄"},
  {task:"Write a product review for coffee from a developer's perspective",icon:"☕"},
  {task:"Create a team name and motto for a hackathon team",icon:"🏆"},
  {task:"Explain why dark mode is superior in exactly 3 reasons",icon:"🌙"},
  {task:"Write a tweet announcing you just fixed a 3-day bug",icon:"🐦"},
  {task:"Describe cloud computing using a weather metaphor",icon:"⛅"},
  {task:"Write a haiku about a null pointer exception",icon:"🎋"},
  {task:"Pitch the idea of 'naps at work' to a CEO using productivity data (made up is fine)",icon:"😴"},
  {task:"Write an apology letter from JavaScript to all developers",icon:"📜"},
  {task:"Describe what happens when you push to main by accident in 2 sentences",icon:"🔥"},
  {task:"Give advice on work-life balance as if you're a senior developer",icon:"⚖️"},
  {task:"Write a rap verse about CSS not working as expected",icon:"🎤"},
  {task:"Describe AI using ONLY emojis (10 emojis max)",icon:"✨"},
  {task:"Write the best out-of-office email a developer could send",icon:"🏖️"},
  {task:"Explain what 'it works on my machine' means to a non-developer",icon:"🖥️"},
];

async function aiJudge(task, pList, prompts) {
  try {
    const entries = pList.map((p,i) => `P${i+1} - ${p.name}: "${prompts[i]}"`).join("\n");
    const r = await fetch("https://api.pollinations.ai/v1/chat/completions", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        model:"openai",
        messages:[
          {role:"system",content:"You are a sharp competition judge. Return ONLY valid JSON, no markdown, no explanation."},
          {role:"user",content:`Task: "${task}"\n${entries}\nReturn exactly: {"winner":1,"scores":[8,6],"reasoning":"one punchy sentence why winner is better","badges":["Bold","Creative"]}`}
        ],
        seed:Math.floor(Math.random()*9999)
      })
    });
    const d = await r.json();
    const raw = d.choices?.[0]?.message?.content || "";
    return JSON.parse(raw.replace(/```json|```/g,"").trim());
  } catch { return null; }
}

function PromptBattle({ players, onAddScore, onDone }) {
  const PCOLS=["#00f5ff","#ff00c8","#ffe600","#00ff90","#ff6b35","#a855f7"];
  const pList=players&&players.length>=2?players:[{id:1,name:"Player 1"},{id:2,name:"Player 2"}];
  const [phase,setPhase]=useState("submit");
  const [prompts,setPrompts]=useState(()=>pList.map(()=>""));
  const [winner,setWinner]=useState(null);
  const [aiRes,setAiRes]=useState(null);
  const [round,setRound]=useState(0);
  const [confetti,setConfetti]=useState(false);
  const chQueue=useRef(shuffle([...BATTLES]));
  const ch=chQueue.current[round%chQueue.current.length];

  // ── Audience voting via MQTT ───────────────────────────────
  const [audRoom]=useState(()=>Math.random().toString(36).substr(2,6).toUpperCase());
  const [audVotes,setAudVotes]=useState({});
  const [audOpen,setAudOpen]=useState(false);
  const audMqtt=useRef(null);

  useEffect(()=>{
    const client=mqtt.connect("wss://broker.emqx.io:8084/mqtt",{
      clientId:`chitti_pb_${Math.random().toString(36).substr(2,8)}`,
      clean:true,reconnectPeriod:3000,connectTimeout:8000,
    });
    audMqtt.current=client;
    client.on("connect",()=>client.subscribe(`chitti/${audRoom}/audvote`,{qos:0}));
    client.on("message",(_,payload)=>{
      try{
        const {team}=JSON.parse(payload.toString());
        setAudVotes(v=>({...v,[team]:(v[team]||0)+1}));
      }catch{}
    });
    return()=>client.end(true);
  },[audRoom]);

  function audVoteUrl(){
    const teams=pList.map(p=>encodeURIComponent(p.name)).join("|");
    return `${window.location.origin}/vote?room=${audRoom}&teams=${teams}`;
  }

  const totalAudVotes=Object.values(audVotes).reduce((a,b)=>a+b,0);

  function setPrompt(i,v){setPrompts(ps=>{const n=[...ps];n[i]=v;return n;});}

  async function reveal(){
    if(prompts.some(p=>!p.trim()))return;
    setPhase("judging");
    const res = await aiJudge(ch.task, pList, prompts);
    if(res){
      setAiRes(res);
      const wi = Math.max(0, Math.min((res.winner||1)-1, pList.length-1));
      setWinner(wi);
      pList.forEach((_,j)=>onAddScore(j===wi?50:-10, j));
      S.fanfare(); setConfetti(true); setTimeout(()=>setConfetti(false),2800);
      setPhase("result");
    } else {
      setPhase("judge"); // AI failed → fallback to manual host judging
    }
  }

  function pickWinner(i){
    setWinner(i);
    pList.forEach((_,j)=>onAddScore(j===i?50:-10, j));
    S.fanfare(); setConfetti(true); setTimeout(()=>setConfetti(false),2800);
    setPhase("result");
  }

  return(
    <div>
      <Confetti on={confetti}/>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
        <div style={{fontFamily:"Orbitron",color:"#ffe600",fontSize:"0.9rem",textShadow:"0 0 10px #ffe600"}}>⚔️ Prompt Battle</div>
        <span style={{fontFamily:"Orbitron",color:"#252e60",fontSize:"0.62rem"}}>Round {round+1}</span>
      </div>
      <div style={{...card("#ffe60030","#ffe60008"),marginBottom:20,textAlign:"center",padding:"18px 20px"}}>
        <div style={{fontSize:"2rem",marginBottom:8}}>{ch.icon}</div>
        <div style={{fontFamily:"Orbitron",color:"#4050a0",fontSize:"0.58rem",letterSpacing:"0.12em",marginBottom:6}}>⚡ CHALLENGE</div>
        <div style={{fontSize:"1.05rem",fontWeight:600,color:"#e0d080",fontFamily:"Rajdhani"}}>{ch.task}</div>
      </div>

      {phase==="submit"&&(
        <>
          <div style={{display:"grid",gridTemplateColumns:`repeat(${Math.min(pList.length,3)},1fr)`,gap:12,marginBottom:20}}>
            {pList.map((p,i)=>(
              <div key={p.id}>
                <div style={{fontFamily:"Orbitron",color:PCOLS[i%PCOLS.length],fontSize:"0.6rem",marginBottom:8,letterSpacing:"0.1em"}}>👤 {p.name}</div>
                <textarea placeholder={`Write your response…\n\nBe creative & original!`}
                  value={prompts[i]||""} onChange={e=>setPrompt(i,e.target.value)}
                  style={{background:"#070910",border:`1.5px solid ${(prompts[i]||"").length>5?PCOLS[i%PCOLS.length]+"60":"#1a2040"}`,borderRadius:6,
                    color:"#c0d8f8",fontFamily:"Rajdhani",fontSize:"1rem",padding:"11px 14px",width:"100%",
                    outline:"none",resize:"vertical",minHeight:90,transition:"border-color 0.2s"}}/>
                <div style={{fontFamily:"Orbitron",fontSize:"0.5rem",color:(prompts[i]||"").length>5?"#2a3560":"#1a2040",marginTop:3}}>{(prompts[i]||"").length} chars</div>
              </div>
            ))}
          </div>
          <div style={{textAlign:"center"}}>
            <button style={{...btn("#ffe600"),fontSize:"1rem",padding:"16px 52px",opacity:prompts.every(p=>p.trim())?1:0.35}}
              onClick={reveal} disabled={!prompts.every(p=>p.trim())}>
              ⚡ BATTLE!
            </button>
          </div>
        </>
      )}

      {phase==="judging"&&(
        <div style={{textAlign:"center",padding:"50px 0"}}>
          <div style={{display:"flex",justifyContent:"center",gap:20,marginBottom:20,flexWrap:"wrap"}}>
            {pList.map((p,i)=>(
              <div key={p.id} style={{textAlign:"center"}}>
                <div style={{width:44,height:44,border:`3px solid ${PCOLS[i%PCOLS.length]}40`,borderTopColor:PCOLS[i%PCOLS.length],borderRadius:"50%",animation:"spin 0.8s linear infinite",margin:"0 auto 10px"}}/>
                <div style={{fontFamily:"Orbitron",color:PCOLS[i%PCOLS.length],fontSize:"0.56rem"}}>{p.name}</div>
              </div>
            ))}
          </div>
          <div style={{fontFamily:"Orbitron",color:"#ffe600",fontSize:"0.78rem",letterSpacing:"0.15em"}}>CLAUDE IS JUDGING…</div>
          <div style={{color:"#252e60",fontSize:"0.8rem",marginTop:8,fontFamily:"Rajdhani"}}>Evaluating all responses</div>
        </div>
      )}

      {phase==="judge"&&(
        <div style={{animation:"fadeUp 0.4s ease both"}}>
          <div style={{...card("#ffe60020"),marginBottom:16,padding:"12px 16px",textAlign:"center"}}>
            <div style={{fontFamily:"Orbitron",color:"#ffe600",fontSize:"0.6rem",letterSpacing:"0.15em",marginBottom:4}}>🧑‍⚖️ HOST: PICK THE WINNER!</div>
            <div style={{color:"#252e60",fontSize:"0.8rem",fontFamily:"Rajdhani"}}>Read all responses aloud, then tap the best one</div>
          </div>
          {/* Audience vote QR */}
          <div style={{...card("#ff00c820"),marginBottom:16,padding:"12px 16px",border:"1px solid #ff00c840"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <div style={{fontFamily:"Orbitron",color:"#ff00c8",fontSize:"0.58rem",letterSpacing:"0.12em"}}>📱 AUDIENCE VOTE</div>
              <button onClick={()=>setAudOpen(o=>!o)}
                style={{...btn("#ff00c8",true),fontSize:"0.5rem",padding:"3px 10px"}}>{audOpen?"HIDE QR":"SHOW QR"}</button>
            </div>
            {audOpen&&(
              <div style={{display:"flex",gap:16,alignItems:"flex-start",flexWrap:"wrap"}}>
                <div style={{background:"#fff",padding:8,borderRadius:6,border:"2px solid #ff00c860"}}>
                  <QRCodeSVG value={audVoteUrl()} size={90} bgColor="#ffffff" fgColor="#07080f" level="M"/>
                </div>
                <div style={{flex:1}}>
                  <div style={{fontFamily:"Rajdhani",color:"#3040a0",fontSize:"0.85rem",marginBottom:10}}>Audience scans to vote for best response!</div>
                  {pList.map((p,i)=>{
                    const v=audVotes[p.name]||0;
                    const pct=totalAudVotes>0?Math.round(v/totalAudVotes*100):0;
                    return(
                      <div key={p.id} style={{marginBottom:7}}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                          <span style={{fontFamily:"Orbitron",fontSize:"0.52rem",color:PCOLS[i%PCOLS.length]}}>{p.name}</span>
                          <span style={{fontFamily:"Orbitron",fontSize:"0.52rem",color:"#252e60"}}>{v} votes · {pct}%</span>
                        </div>
                        <div style={{height:8,borderRadius:4,background:"#1a2040",overflow:"hidden"}}>
                          <div style={{height:"100%",borderRadius:4,background:PCOLS[i%PCOLS.length],
                            width:`${pct}%`,transition:"width 0.6s ease"}}/>
                        </div>
                      </div>
                    );
                  })}
                  <div style={{fontFamily:"Orbitron",fontSize:"0.46rem",color:"#252e60",marginTop:6,letterSpacing:"0.1em"}}>
                    {totalAudVotes} AUDIENCE VOTES LIVE
                  </div>
                </div>
              </div>
            )}
          </div>
          <div style={{display:"grid",gridTemplateColumns:`repeat(${Math.min(pList.length,3)},1fr)`,gap:10,marginBottom:16}}>
            {pList.map((p,i)=>{
              const col=PCOLS[i%PCOLS.length];
              return(
                <div key={p.id} style={{...card(col+"30"),borderColor:col+"60",display:"flex",flexDirection:"column",gap:10}}>
                  <div style={{fontFamily:"Orbitron",color:col,fontSize:"0.58rem"}}>{p.name}</div>
                  <div style={{fontSize:"0.95rem",lineHeight:1.65,color:"#d0deff",fontFamily:"Rajdhani",flex:1}}>"{prompts[i]}"</div>
                  <button onClick={()=>pickWinner(i)}
                    style={{...btn(col),fontSize:"0.7rem",padding:"10px 0",width:"100%"}}>
                    🏆 {p.name} WINS!
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {phase==="result"&&winner!==null&&(
        <div style={{animation:"fadeUp 0.4s ease both"}}>
          <div style={{display:"grid",gridTemplateColumns:`repeat(${Math.min(pList.length,3)},1fr)`,gap:10,marginBottom:16}}>
            {pList.map((p,i)=>{
              const isWin=i===winner; const col=PCOLS[i%PCOLS.length];
              return(
                <div key={p.id} style={{...card(isWin?"#ffe60060":"#1a2040"),animation:isWin?"winGlow 2s ease infinite":"none",display:"flex",flexDirection:"column",gap:6}}>
                  {isWin&&<div style={{fontFamily:"Orbitron",color:"#ffe600",fontSize:"0.56rem"}}>🏆 WINNER!</div>}
                  <div style={{fontFamily:"Orbitron",color:col,fontSize:"0.58rem"}}>{p.name}</div>
                  <div style={{fontFamily:"Orbitron",fontSize:"0.85rem",fontWeight:900,color:isWin?"#00ff90":"#ff4060",marginTop:2}}>{isWin?"+50 pts":"-10 pts"}</div>
                  <div style={{fontSize:"0.88rem",color:"#3a4060",fontStyle:"italic",fontFamily:"Rajdhani"}}>"{prompts[i]}"</div>
                  {aiRes&&(
                    <div style={{display:"flex",alignItems:"center",gap:6,marginTop:4}}>
                      <span style={{fontFamily:"Orbitron",color:"#00f5ff",fontSize:"1.1rem",fontWeight:900}}>{aiRes.scores?.[i]??"-"}</span>
                      <span style={{fontFamily:"Orbitron",color:"#1a2040",fontSize:"0.52rem"}}>/10</span>
                      {aiRes.badges?.[i]&&<span style={{background:"#ffffff08",borderRadius:3,padding:"2px 8px",fontSize:"0.7rem",color:"#3a4560",fontStyle:"italic"}}>{aiRes.badges[i]}</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {aiRes?.reasoning&&(
            <div style={{...card("#ffe60028"),marginBottom:16}}>
              <div style={{fontFamily:"Orbitron",color:"#3a4060",fontSize:"0.54rem",marginBottom:6,letterSpacing:"0.1em"}}>🤖 CLAUDE'S VERDICT</div>
              <div style={{color:"#d0c080",fontSize:"1rem",fontFamily:"Rajdhani"}}>{aiRes.reasoning}</div>
            </div>
          )}
          <ScorePanel players={players} onBack={onDone}/>
          <div style={{textAlign:"center",marginTop:12}}>
            <button style={btn("#ffe600",true)} onClick={()=>{setPhase("submit");setPrompts(pList.map(()=>""));setWinner(null);setAiRes(null);setRound(r=>r+1);}}>↺ Next Challenge</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── BUZZER MODE ───────────────────────────────────────────────
// ── LIGHTNING ROUND BANK ──────────────────────────────────────
const LIGHTNING_BANK = shuffle([
  {q:"Full form of UPI?",opts:["United Payment Interface","Unified Payments Interface","Universal Payment Index","Unified Public Infrastructure"],a:1},
  {q:"UPI was launched in which year?",opts:["2014","2015","2016","2017"],a:2},
  {q:"Which organisation operates UPI?",opts:["RBI","SBI","NPCI","SEBI"],a:2},
  {q:"Max UPI single transaction limit (general)?",opts:["₹50,000","₹1 lakh","₹2 lakh","₹5 lakh"],a:1},
  {q:"IMPS stands for?",opts:["Immediate Money Payment System","Instant Mobile Payment Service","Immediate Payment Service","Integrated Mobile Payment System"],a:2},
  {q:"NEFT settles transactions in?",opts:["Real-time","15-min batches","Half-hourly batches","Daily batches"],a:2},
  {q:"Minimum RTGS transfer amount?",opts:["₹50,000","₹1 lakh","₹2 lakh","₹5 lakh"],a:2},
  {q:"RuPay card network is owned by?",opts:["RBI","Visa","NPCI","Mastercard"],a:2},
  {q:"FASTag uses which technology?",opts:["NFC","Bluetooth","RFID","GPS"],a:2},
  {q:"BHIM stands for?",opts:["Bharat Interface for Money","Banking Hub India Mobile","Bharat Integrated Mobile","Banking Interface for Money"],a:0},
  {q:"KYC stands for?",opts:["Know Your Customer","Keep Your Credentials","Know Your Currency","Key Your Code"],a:0},
  {q:"AePS authenticates using?",opts:["PIN","Biometric","OTP","Password"],a:1},
  {q:"BBPS is used for?",opts:["Stock trading","Bill payments","Bank transfers","Loan applications"],a:1},
  {q:"Primary regulator of payment systems in India?",opts:["SEBI","IRDAI","RBI","NPCI"],a:2},
  {q:"POS stands for?",opts:["Point of Sale","Place of Service","Payment of Sale","Point of Service"],a:0},
  {q:"UPI transaction settlement cycle?",opts:["Same day","T+1","T+2","T+3"],a:1},
  {q:"Which is NOT a UPI app?",opts:["PhonePe","Google Pay","SWIFT","BHIM"],a:2},
  {q:"NACH is used for?",opts:["One-time payments","Recurring mandates","International transfers","ATM withdrawals"],a:1},
  {q:"Full form of NPCI?",opts:["National Payments Corp of India","National Public Credit Institute","New Payments Central India","National Private Credit Institution"],a:0},
  {q:"QR in QR Code stands for?",opts:["Queue Response","Quick Response","Query Record","Quick Record"],a:1},
  {q:"Which payment mode works 24x7x365?",opts:["NEFT","RTGS","IMPS","Cheque"],a:2},
  {q:"Bharat QR supports which networks?",opts:["Only UPI","Only RuPay","Visa, Mastercard, RuPay & UPI","Only Visa"],a:2},
  {q:"UPI VPA stands for?",opts:["Virtual Payment Address","Verified Payment Account","Variable Payment API","Virtual Public Account"],a:0},
  {q:"India's first UPI app was?",opts:["PhonePe","Paytm","BHIM","Google Pay"],a:2},
  {q:"Payment aggregators in India are regulated by?",opts:["SEBI","NPCI","RBI","Ministry of Finance"],a:2},
]);

// ── LOGO ROUND BANK ───────────────────────────────────────────
const LOGO_BANK = shuffle([
  {name:"PhonePe",  color:"#ffffff", bg:"#5f259f", hints:["India's largest UPI app by volume","Purple brand — owned by Walmart","PE = Payment Experience"]},
  {name:"Razorpay", color:"#ffffff", bg:"#0a2540", hints:["Payment gateway for online businesses","Blue brand, founded 2014 Bangalore","Founded by Harshil Mathur & Shashank Kumar"]},
  {name:"Paytm",    color:"#00baf2", bg:"#001f5b", hints:["First major Indian digital wallet","Blue & sky-blue brand","Founded by Vijay Shekhar Sharma, 2010"]},
  {name:"Google Pay",color:"#ffffff",bg:"#1a1a2e", hints:["Google's UPI-based payment app","Short name: GPay","Previously called 'Tez' when launched in India"]},
  {name:"BharatPe", color:"#ffffff", bg:"#c0392b", hints:["QR code payments for merchants","Red-orange brand","Co-founded by Ashneer Grover"]},
  {name:"NPCI",     color:"#ffffff", bg:"#006838", hints:["Governs UPI, RuPay, IMPS, NACH","Green brand — not-for-profit","Stands for National Payments Corporation of India"]},
  {name:"CRED",     color:"#d4af37", bg:"#111111", hints:["Premium credit card bill payment app","Dark luxury brand","Founded by Kunal Shah"]},
  {name:"RuPay",    color:"#ffffff", bg:"#c0392b", hints:["India's own domestic card network","Red brand by NPCI","Competes with Visa & Mastercard"]},
  {name:"MobiKwik", color:"#ffffff", bg:"#0066cc", hints:["Indian digital wallet & BNPL","Blue brand","Founded 2009 — one of India's oldest wallets"]},
  {name:"Cashfree", color:"#ffffff", bg:"#4f46e5", hints:["Payment gateway & bulk payouts","Indigo/purple brand","Backed by Y Combinator & Sequoia"]},
  {name:"Pine Labs", color:"#ffffff", bg:"#00796b", hints:["POS terminal & merchant payments","Teal brand","Powers payment terminals in retail stores"]},
  {name:"CRED",     color:"#d4af37", bg:"#111111", hints:["Pay credit card bills, earn rewards","Dark luxury brand","Unicorn founded by Kunal Shah in 2018"]},
]);

// ── LIGHTNING ROUND COMPONENT ─────────────────────────────────
function LightningRound({ players, onAddScore, onDone }) {
  const pList = players&&players.length>=1 ? players : [{id:1,name:"Team"}];
  const PCOLS = ["#00f5ff","#ff00c8","#ffe600","#00ff90","#ff6b35","#a855f7"];
  const TOTAL = 10;
  const [qIdx,  setQIdx]  = useState(0);
  const [phase, setPhase] = useState("question"); // question | reveal
  const [timer, setTimer] = useState(5);
  const [teamVotes, setTeamVotes] = useState({});
  const [revealed, setRevealed] = useState(false);
  const [confetti, setConfetti] = useState(false);
  const tref = useRef(); const timerRef = useRef(10);

  const q = LIGHTNING_BANK[qIdx % LIGHTNING_BANK.length];

  useEffect(()=>{
    setTeamVotes({}); setRevealed(false); setTimer(10); timerRef.current=10;
  },[qIdx]);

  useEffect(()=>{
    if(phase!=="question") return;
    tref.current = setInterval(()=>{
      setTimer(t=>{
        const nt=t-1; timerRef.current=nt;
        if(t<=4) S.tick();
        if(t<=1){ clearInterval(tref.current); doReveal(); return 0; }
        return nt;
      });
    },1000);
    return ()=>clearInterval(tref.current);
  },[phase, qIdx]);

  useEffect(()=>{
    if(phase!=="question"||revealed) return;
    if(pList.length>0&&pList.every(p=>teamVotes[p.id]!==undefined)) doReveal();
  },[teamVotes]);

  function doReveal(){
    clearInterval(tref.current); setRevealed(true); setPhase("reveal");
    let any=false;
    pList.forEach((p,i)=>{
      if(teamVotes[p.id]===q.a){ onAddScore(50,i); any=true; }
      else if(teamVotes[p.id]!==undefined){ onAddScore(-10,i); }
    });
    if(any){ S.correct(); setConfetti(true); setTimeout(()=>setConfetti(false),1500); }
    else S.wrong();
    // No auto-advance — host presses Next manually
  }

  function nextQ(){
    if(qIdx+1>=TOTAL){ setQIdx(TOTAL); return; }
    setPhase("question"); setQIdx(i=>i+1);
  }

  if(qIdx>=TOTAL) return(
    <div style={{textAlign:"center",padding:"40px 0"}}>
      <div style={{fontSize:"3rem",marginBottom:12}}>⚡</div>
      <div style={{fontFamily:"Orbitron",color:"#ffe600",fontSize:"1.4rem",textShadow:"0 0 14px #ffe600",marginBottom:8}}>Lightning Round Over!</div>
      <button style={btn("#ffe600")} onClick={onDone}>VIEW RESULTS →</button>
    </div>
  );

  return(
    <div>
      <Confetti on={confetti}/>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div style={{fontFamily:"Orbitron",color:"#ffe600",fontSize:"0.85rem",textShadow:"0 0 10px #ffe600"}}>⚡ LIGHTNING ROUND</div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontFamily:"Orbitron",color:"#252e60",fontSize:"0.62rem"}}>Q{Math.min(qIdx+1,TOTAL)}/{TOTAL}</span>
          {phase==="question"&&(
            <div style={{width:44,height:44,position:"relative"}}>
              <svg width="44" height="44" style={{transform:"rotate(-90deg)"}}>
                <circle cx="22" cy="22" r="18" fill="none" stroke="#1a2040" strokeWidth="3"/>
                <circle cx="22" cy="22" r="18" fill="none" stroke={timer<=2?"#ff4060":"#ffe600"} strokeWidth="3"
                  strokeDasharray={`${2*Math.PI*18}`}
                  strokeDashoffset={`${2*Math.PI*18*(1-timer/10)}`}
                  style={{transition:"stroke-dashoffset 0.9s linear,stroke 0.3s"}}/>
              </svg>
              <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",
                fontFamily:"Orbitron",fontWeight:900,fontSize:"1rem",color:timer<=2?"#ff4060":"#ffe600"}}>{timer}</div>
            </div>
          )}
        </div>
      </div>
      {/* Question */}
      <div style={{...card("#ffe60022"),border:"2px solid #ffe60040",marginBottom:14}}>
        <div style={{fontFamily:"Rajdhani",fontSize:"1.15rem",fontWeight:700,color:"#e0eaff",lineHeight:1.6}}>{q.q}</div>
      </div>
      {/* Options grid */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
        {q.opts.map((opt,oi)=>{
          let bc="#1a2040",bg="#0d1020",col="#8090b0";
          if(phase==="reveal"){ if(oi===q.a){bc="#00ff90";bg="#00ff9018";col="#00ff90";} }
          return(
            <div key={oi} style={{padding:"12px 14px",borderRadius:6,border:`2px solid ${bc}`,
              background:bg,color:col,fontFamily:"Rajdhani",fontSize:"0.95rem",fontWeight:600,
              boxShadow:phase==="reveal"&&oi===q.a?"0 0 18px #00ff9050":"none",
              transition:"all 0.3s"}}>
              <span style={{opacity:0.4,marginRight:7,fontFamily:"Orbitron",fontSize:"0.58rem"}}>{"ABCD"[oi]}</span>
              {opt}
            </div>
          );
        })}
      </div>
      {/* Per-team buzzer buttons */}
      {phase==="question"&&(
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          <div style={{fontFamily:"Orbitron",fontSize:"0.5rem",color:"#252e60",letterSpacing:"0.12em",marginBottom:2}}>TEAM ANSWERS:</div>
          {pList.map((p,pi)=>{
            const col=PCOLS[pi%PCOLS.length];
            const voted=teamVotes[p.id];
            return(
              <div key={p.id} style={{display:"flex",alignItems:"center",gap:6,padding:"7px 12px",
                borderRadius:8,border:`1px solid ${voted!==undefined?col+"60":"#1a2040"}`,background:"#0a0c18",flexWrap:"wrap"}}>
                <span style={{fontFamily:"Orbitron",fontSize:"0.54rem",color:col,flex:"0 0 85px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</span>
                {q.opts.map((_,oi)=>(
                  <button key={oi} onClick={()=>setTeamVotes(v=>({...v,[p.id]:oi}))}
                    style={{fontFamily:"Orbitron",fontSize:"0.55rem",padding:"5px 12px",borderRadius:4,
                      border:`1px solid ${voted===oi?col:"#1a2040"}`,
                      background:voted===oi?col+"20":"transparent",
                      color:voted===oi?col:"#3a4570",cursor:"pointer",transition:"all 0.15s"}}>
                    {"ABCD"[oi]}
                  </button>
                ))}
                {voted!==undefined&&<span style={{color:col,marginLeft:"auto"}}>✓</span>}
              </div>
            );
          })}
        </div>
      )}
      {/* Reveal results */}
      {phase==="reveal"&&(
        <div style={{display:"flex",flexDirection:"column",gap:6,marginTop:8}}>
          {pList.map((p,pi)=>{
            const col=PCOLS[pi%PCOLS.length];
            const correct=teamVotes[p.id]===q.a;
            return(
              <div key={p.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 14px",
                borderRadius:8,border:`1px solid ${correct?"#00ff9060":"#ff406040"}`,
                background:correct?"#00ff9008":"#ff406008"}}>
                <span style={{fontFamily:"Orbitron",fontSize:"0.56rem",color:col,flex:"0 0 85px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</span>
                <span style={{fontFamily:"Orbitron",fontSize:"0.6rem",color:correct?"#00ff90":"#ff4060"}}>
                  {teamVotes[p.id]!==undefined?`${["A","B","C","D"][teamVotes[p.id]]} — `:"No answer — "}
                  {teamVotes[p.id]===undefined?"No answer":correct?"✓ +50 pts":"✗ -10 pts"}
                </span>
              </div>
            );
          })}
        </div>
      )}
      {/* Manual next button shown after reveal */}
      {phase==="reveal"&&(
        <div style={{textAlign:"right",marginTop:14}}>
          <button style={btn("#ffe600",true)} onClick={nextQ}>
            {qIdx+1>=TOTAL?"🎉 Finish":"Next Question →"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── LOGO ROUND COMPONENT ──────────────────────────────────────
function LogoRound({ players, onAddScore, onDone }) {
  const pList = players&&players.length>=1 ? players : [{id:1,name:"Team"}];
  const PCOLS = ["#00f5ff","#ff00c8","#ffe600","#00ff90","#ff6b35","#a855f7"];
  const TOTAL = 6;
  const [idx,      setIdx]      = useState(0);
  const [hintIdx,  setHintIdx]  = useState(0); // 0=max blur, 1=medium, 2=clear
  const [revealed, setRevealed] = useState(false);
  const [winner,   setWinner]   = useState(null);
  const [confetti, setConfetti] = useState(false);
  const [phase,    setPhase]    = useState("buzz"); // buzz | awarded

  const logo = LOGO_BANK[idx % LOGO_BANK.length];
  const blurs = [28, 10, 0];
  const pts   = [150, 100, 50];

  function buzz(p, pi) {
    if(winner||revealed) return;
    S.buzzer(); setWinner({p, pi});
  }

  function awardCorrect() {
    if(!winner) return;
    S.correct(); onAddScore(pts[hintIdx], winner.pi);
    setConfetti(true); setTimeout(()=>setConfetti(false),2500);
    setRevealed(true); setPhase("awarded");
  }

  function awardWrong() {
    S.wrong(); setWinner(null);
  }

  function nextLogo() {
    setIdx(i=>i+1); setHintIdx(0); setRevealed(false); setWinner(null); setPhase("buzz");
  }

  if(idx>=TOTAL) return(
    <div style={{textAlign:"center",padding:"40px 0"}}>
      <div style={{fontSize:"3rem",marginBottom:12}}>🏷️</div>
      <div style={{fontFamily:"Orbitron",color:"#ff00c8",fontSize:"1.4rem",textShadow:"0 0 14px #ff00c8",marginBottom:8}}>Logo Round Over!</div>
      <button style={btn("#ff00c8")} onClick={onDone}>VIEW RESULTS →</button>
    </div>
  );

  return(
    <div>
      <Confetti on={confetti}/>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div style={{fontFamily:"Orbitron",color:"#ff00c8",fontSize:"0.85rem",textShadow:"0 0 10px #ff00c8"}}>🏷️ GUESS THE FINTECH</div>
        <span style={{fontFamily:"Orbitron",color:"#252e60",fontSize:"0.62rem"}}>LOGO {idx+1}/{TOTAL}</span>
      </div>

      {/* Logo card with blur */}
      <div style={{...card(),marginBottom:16,display:"flex",flexDirection:"column",alignItems:"center",
        padding:"32px 20px",background:logo.bg,border:`2px solid ${logo.color}30`}}>
        <div style={{
          fontFamily:"Orbitron",fontWeight:900,fontSize:"2.4rem",color:logo.color,
          letterSpacing:"0.04em",textShadow:`0 0 30px ${logo.color}80`,
          filter:`blur(${blurs[hintIdx]}px)`,transition:"filter 0.8s ease",
          userSelect:"none",textAlign:"center",padding:"10px 20px",
          background:`${logo.color}10`,borderRadius:12,minWidth:200
        }}>{logo.name}</div>
        <div style={{marginTop:14,fontFamily:"Orbitron",fontSize:"0.5rem",color:"#252e60",letterSpacing:"0.15em"}}>
          {revealed ? `✅ ${logo.name}` : hintIdx===0?"IDENTIFY THIS FINTECH BRAND":hintIdx===1?"GETTING CLEARER…":"FULLY REVEALED"}
        </div>
      </div>

      {/* Hints + points */}
      <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
        {logo.hints.map((h,i)=>(
          <div key={i} style={{flex:1,minWidth:120,...card(i<hintIdx+1?"#ffe60020":"#1a204010"),
            padding:"8px 12px",opacity:i<hintIdx+1?1:0.3}}>
            <div style={{fontFamily:"Orbitron",fontSize:"0.45rem",color:"#ffe600",letterSpacing:"0.1em",marginBottom:3}}>
              HINT {i+1} · {pts[i]} pts
            </div>
            <div style={{fontFamily:"Rajdhani",fontSize:"0.82rem",color:i<hintIdx+1?"#d0e0ff":"#1a2040"}}>
              {i<hintIdx+1 ? h : "???"}
            </div>
          </div>
        ))}
      </div>

      {/* Controls */}
      {!revealed&&(
        <div style={{display:"flex",gap:8,marginBottom:14}}>
          {hintIdx<2&&(
            <button onClick={()=>{S.lifeline();setHintIdx(h=>h+1);}}
              style={{...btn("#ffe600",true),flex:1,fontSize:"0.62rem"}}>
              💡 NEXT HINT (-{pts[hintIdx]-pts[Math.min(hintIdx+1,2)]} pts)
            </button>
          )}
          <button onClick={()=>{setRevealed(true);setHintIdx(2);}}
            style={{...btn("#ff4060",true),fontSize:"0.62rem",flex:1}}>
            👁 REVEAL LOGO
          </button>
        </div>
      )}

      {/* Team buzz buttons */}
      {!revealed&&phase==="buzz"&&(
        <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:12}}>
          <div style={{fontFamily:"Orbitron",fontSize:"0.5rem",color:"#252e60",letterSpacing:"0.12em"}}>BUZZ TO ANSWER ({pts[hintIdx]} PTS):</div>
          {pList.map((p,pi)=>{
            const col=PCOLS[pi%PCOLS.length];
            const isW=winner&&winner.p.id===p.id;
            return(
              <button key={p.id} onClick={()=>buzz(p,pi)}
                disabled={!!winner}
                style={{width:"100%",padding:"14px 18px",borderRadius:8,
                  border:`2px solid ${isW?col:col+"50"}`,
                  background:isW?`${col}20`:"#0a0c18",
                  color:isW?col:col+"80",fontFamily:"Orbitron",fontWeight:700,fontSize:"0.8rem",
                  cursor:winner?"default":"pointer",textAlign:"left",
                  boxShadow:isW?`0 0 20px ${col}50`:"none",transition:"all 0.2s"}}>
                {isW?"🔔 ":""}{p.name}{isW?" — ANSWER NOW!":""}
              </button>
            );
          })}
        </div>
      )}

      {/* Host verdict after buzz */}
      {winner&&!revealed&&(
        <div style={{display:"flex",gap:10}}>
          <button onClick={awardCorrect} style={{...btn("#00ff90"),flex:1,fontSize:"0.7rem"}}>✅ CORRECT +{pts[hintIdx]} pts</button>
          <button onClick={awardWrong}  style={{...btn("#ff4060"),flex:1,fontSize:"0.7rem"}}>❌ WRONG — NEXT TEAM</button>
        </div>
      )}
      {(revealed||phase==="awarded")&&(
        <div style={{textAlign:"right",marginTop:12}}>
          <button onClick={nextLogo} style={btn("#ff00c8",true)}>
            {idx+1>=TOTAL?"🎉 Finish":"Next Logo →"}
          </button>
        </div>
      )}
    </div>
  );
}

const BUZZER_COLORS = ["#00f5ff","#ff00c8","#ffe600","#00ff90","#ff6b35","#a855f7","#ec4899","#38bdf8"];

// ── INDIAN PAYMENT DOMAIN QUESTION BANK ───────────────────────
const BUZZER_QUESTIONS = shuffle([
  {q:"What does UPI stand for?", a:"Unified Payments Interface", hint:"Launched by NPCI in 2016"},
  {q:"Which organisation governs UPI in India?", a:"NPCI (National Payments Corporation of India)", hint:"A not-for-profit entity"},
  {q:"What is the maximum UPI transaction limit per day (general)?", a:"₹1 lakh (₹1,00,000)", hint:"RBI sets this limit"},
  {q:"Which year was UPI officially launched?", a:"2016", hint:"August 25, 2016"},
  {q:"What does IMPS stand for?", a:"Immediate Payment Service", hint:"Works 24×7×365"},
  {q:"What does NEFT stand for?", a:"National Electronic Funds Transfer", hint:"Operates in half-hourly batches"},
  {q:"What does RTGS stand for?", a:"Real Time Gross Settlement", hint:"Minimum ₹2 lakh transfer"},
  {q:"What is the full form of NACH?", a:"National Automated Clearing House", hint:"Used for recurring mandates"},
  {q:"Which card network is India's domestic alternative to Visa/Mastercard?", a:"RuPay", hint:"Launched by NPCI"},
  {q:"What does PPI stand for in payments?", a:"Prepaid Payment Instrument", hint:"E-wallets fall here"},
  {q:"Which regulator oversees payment systems in India?", a:"Reserve Bank of India (RBI)", hint:"Central bank of India"},
  {q:"What is Aadhaar-enabled Payment System called?", a:"AePS", hint:"Uses biometric authentication"},
  {q:"What does BBPS stand for?", a:"Bharat Bill Payment System", hint:"For utility bill payments"},
  {q:"Which UPI feature allows offline payments via NFC?", a:"UPI Lite X", hint:"No internet needed"},
  {q:"What is the settlement cycle for UPI transactions?", a:"T+1 (next business day)", hint:"Cleared by NPCI"},
  {q:"Which payment mode is best for high-value same-day transfers above ₹2 lakh?", a:"RTGS", hint:"Real-time, minimum ₹2L"},
  {q:"What does KYC stand for in banking/payments?", a:"Know Your Customer", hint:"Identity verification process"},
  {q:"What is the credit product launched on UPI rails?", a:"UPI Credit Line / RuPay Credit on UPI", hint:"Link credit card to UPI"},
  {q:"What does POS stand for in payment terminals?", a:"Point of Sale", hint:"The swipe machine at shops"},
  {q:"Which payment app was India's first UPI-based app?", a:"BHIM", hint:"Bharat Interface for Money"},
  {q:"What does FASTag use for toll collection?", a:"RFID (Radio Frequency Identification)", hint:"Stick on windshield"},
  {q:"What is the name of India's cross-border UPI-equivalent initiative?", a:"UPI One World / Project Nexus", hint:"International expansion"},
  {q:"What does EMI stand for?", a:"Equated Monthly Instalment", hint:"Loan repayment structure"},
  {q:"Which entity issues a UPI Virtual Payment Address (VPA)?", a:"Payment Service Provider / Bank (PSP)", hint:"e.g. @okaxis, @ybl"},
  {q:"What is the maximum wallet limit for a fully KYC-compliant PPI?", a:"₹2 lakh", hint:"RBI PPI Master Directions"},
  {q:"Which payment rail is used for salary disbursement in bulk?", a:"NEFT or NACH (ECS)", hint:"Batch-based clearing"},
  {q:"What does QR stand for in QR code payments?", a:"Quick Response", hint:"Invented in Japan, used in Bharat QR"},
  {q:"What is Bharat QR?", a:"A unified QR standard for card and UPI payments", hint:"Interoperable across Visa, Mastercard, RuPay, UPI"},
  {q:"What is the purpose of a payment aggregator (PA)?", a:"To collect payments on behalf of merchants and settle to their accounts", hint:"Regulated by RBI since 2020"},
  {q:"What does TPAP stand for in UPI?", a:"Third Party Application Provider", hint:"e.g. PhonePe, Google Pay"},
]);

const MQTT_URL = "wss://broker.emqx.io:8084/mqtt"; // free public broker, no sign-up needed

function BuzzerMode({ players, onAddScore }) {
  // ── Room code — unique per session, shared via QR ─────────────
  const [roomCode] = useState(() => Math.random().toString(36).substr(2,6).toUpperCase());

  // ── MQTT connection ───────────────────────────────────────────
  const [mqttConn, setMqttConn] = useState(false);
  const mqttRef    = useRef(null);

  // ── Game state (MQTT-driven or local fallback) ────────────────
  const [phase,    setPhase]    = useState("idle");
  const [winner,   setWinner]   = useState(null);
  const [buzzTime, setBuzzTime] = useState(null);
  const [disabled, setDisabled] = useState([]);

  // Refs keep closure-safe copies for MQTT message handlers
  const phaseRef    = useRef("idle");
  const winnerRef   = useRef(null);
  const disabledRef = useRef([]);

  // ── Local countdown + single-screen timing ────────────────────
  const [cdPhase, setCdPhase] = useState(false);
  const [cd,      setCd]      = useState(3);
  const [showQR,  setShowQR]  = useState(true);
  const cdRef      = useRef(null);
  const lStartRef  = useRef(null);

  // ── Question bank ─────────────────────────────────────────────
  const qQueueRef  = useRef([...BUZZER_QUESTIONS]);
  const [currentQ, setCurrentQ] = useState(null);
  const [showAns,  setShowAns]  = useState(false);
  const hostPopup  = useRef(null);

  function hostPanelHTML(q, revealed) {
    return `<!DOCTYPE html><html><head><title>Host Panel</title>
<style>*{margin:0;padding:0;box-sizing:border-box;}
body{background:#07080f;color:#e0eaff;font-family:sans-serif;padding:20px;min-height:100vh;}
.label{font-size:0.55rem;letter-spacing:0.15em;color:#ff4060;margin-bottom:6px;font-weight:700;}
.q{font-size:1.1rem;font-weight:700;line-height:1.6;margin-bottom:18px;color:#e0eaff;}
.ans{background:#00ff9015;border:1px solid #00ff9050;border-radius:8px;padding:14px 16px;margin-bottom:10px;}
.ans-text{font-size:1.2rem;font-weight:700;color:#00ff90;margin-bottom:6px;}
.hint{font-size:0.85rem;color:#3a5570;}
.footer{margin-top:20px;font-size:0.55rem;color:#1a2040;letter-spacing:0.12em;}
</style></head><body>
<div class="label">🔒 HOST EYES ONLY · CHITTI TECH ARENA</div>
<div class="q">${q ? q.q : '—'}</div>
<div class="ans">
  <div class="label">✅ CORRECT ANSWER</div>
  <div class="ans-text">${q ? q.a : '—'}</div>
  ${q && q.hint ? `<div class="hint">💡 ${q.hint}</div>` : ''}
</div>
<div class="footer">Keep this window on your private screen only</div>
</body></html>`;
  }

  function openHostPanel() {
    if (hostPopup.current && !hostPopup.current.closed) {
      hostPopup.current.focus(); return;
    }
    const popup = window.open('', 'HostPanel',
      'width=480,height=320,top=100,left=100,resizable=yes,scrollbars=no,toolbar=no,menubar=no,location=no');
    hostPopup.current = popup;
    popup.document.open();
    popup.document.write(hostPanelHTML(currentQ, showAns));
    popup.document.close();
  }

  // Keep popup in sync whenever question changes
  useEffect(() => {
    if (!hostPopup.current || hostPopup.current.closed) return;
    hostPopup.current.document.open();
    hostPopup.current.document.write(hostPanelHTML(currentQ, showAns));
    hostPopup.current.document.close();
  }, [currentQ]);

  function nextQuestion() {
    if (qQueueRef.current.length === 0) qQueueRef.current = shuffle([...BUZZER_QUESTIONS]);
    setCurrentQ(qQueueRef.current.pop());
    setShowAns(false);
  }

  // ── Scores ────────────────────────────────────────────────────
  const [scores, setScores] = useState(() =>
    Object.fromEntries(players.map(p => [p.id, p.score]))
  );
  useEffect(() => {
    setScores(Object.fromEntries(players.map(p => [p.id, p.score])));
  }, [players]);

  // ── Keep refs in sync ─────────────────────────────────────────
  useEffect(() => { phaseRef.current    = phase;    }, [phase]);
  useEffect(() => { winnerRef.current   = winner;   }, [winner]);
  useEffect(() => { disabledRef.current = disabled; }, [disabled]);

  // ── MQTT: connect once on mount ───────────────────────────────
  useEffect(() => {
    const client = mqtt.connect(MQTT_URL, {
      clientId: `chitti_host_${Math.random().toString(36).substr(2,8)}`,
      clean: true, reconnectPeriod: 3000, connectTimeout: 8000,
    });
    mqttRef.current = client;

    client.on("connect", () => {
      setMqttConn(true);
      client.subscribe(`chitti/${roomCode}/buzz`, { qos: 0 });
      // Publish current state so any late-connecting phones get it
      pubState("idle", null, null, []);
    });
    client.on("offline",    () => setMqttConn(false));
    client.on("error",      () => {});  // suppress

    client.on("message", (_topic, payload) => {
      try {
        const msg = JSON.parse(payload.toString());
        // Only accept first buzz when in ready phase
        if (
          phaseRef.current === "ready" &&
          !winnerRef.current &&
          !disabledRef.current.includes(msg.team)
        ) {
          winnerRef.current = msg.team;
          phaseRef.current  = "buzzed";
          setWinner(msg.team);
          setBuzzTime(msg.elapsed);
          setPhase("buzzed");
          S.buzzer();
          pubState("buzzed", msg.team, msg.elapsed, disabledRef.current);
        }
      } catch {}
    });

    return () => { client.end(true); clearInterval(cdRef.current); };
  }, [roomCode]);

  // ── Publish state to all phones ───────────────────────────────
  function pubState(p, w, bt, dis) {
    mqttRef.current?.publish(
      `chitti/${roomCode}/state`,
      JSON.stringify({ phase:p, winner:w, buzzTime:bt, disabledTeams:dis }),
      { retain: true, qos: 0 }
    );
  }

  // ── Host actions ──────────────────────────────────────────────
  function startRound() {
    S.swoosh();
    setWinner(null); setBuzzTime(null); setDisabled([]);
    winnerRef.current = null; disabledRef.current = [];
    nextQuestion();
    setCdPhase(true); setCd(3);
    let c = 3;
    cdRef.current = setInterval(() => {
      c--;
      if (c <= 0) {
        clearInterval(cdRef.current); setCdPhase(false); S.ding();
        phaseRef.current = "ready";
        setPhase("ready");
        lStartRef.current = performance.now();
        pubState("ready", null, null, disabledRef.current);
      } else { S.tick(); setCd(c); }
    }, 1000);
  }

  // Local buzz — used in single-screen mode (MQTT offline)
  function localBuzz(p) {
    if (phaseRef.current !== "ready" || winnerRef.current || disabledRef.current.includes(p.name)) return;
    const elapsed = ((performance.now() - lStartRef.current) / 1000).toFixed(2);
    S.buzzer();
    winnerRef.current = p.name; phaseRef.current = "buzzed";
    setWinner(p.name); setBuzzTime(elapsed); setPhase("buzzed");
  }

  function awardCorrect() {
    if (!winner) return; S.correct();
    const wp = players.find(x => x.name === winner);
    if (wp) {
      players.forEach(p => onAddScore(p.id===wp.id?50:-10, p.id));
      setScores(s => ({...s,[wp.id]:(s[wp.id]||0)+50}));
    }
    phaseRef.current = "idle"; winnerRef.current = null; disabledRef.current = [];
    setPhase("idle"); setWinner(null); setBuzzTime(null); setDisabled([]);
    pubState("idle", null, null, []);
  }

  function penaliseWrong() {
    if (!winner) return; S.wrong();
    const next = [...disabledRef.current, winner];
    disabledRef.current = next; winnerRef.current = null;
    setDisabled(next); setWinner(null); setBuzzTime(null);
    const remaining = players.filter(p => !next.includes(p.name));
    if (remaining.length === 0) {
      phaseRef.current = "idle"; setPhase("idle");
      pubState("idle", null, null, next);
    } else {
      phaseRef.current = "ready"; setPhase("ready");
      lStartRef.current = performance.now();
      pubState("ready", null, null, next);
    }
  }

  function resetAll() {
    clearInterval(cdRef.current); setCdPhase(false);
    phaseRef.current = "idle"; winnerRef.current = null; disabledRef.current = [];
    setPhase("idle"); setWinner(null); setBuzzTime(null); setDisabled([]);
    setShowAns(false);
    pubState("idle", null, null, []);
  }

  // ── Derived ───────────────────────────────────────────────────
  const displayPhase = cdPhase ? "countdown" : phase;
  const winPlayer    = players.find(p => p.name === winner);
  const playerUrl    = (p, i) =>
    `${window.location.origin}/buzz?team=${encodeURIComponent(p.name)}&ci=${i}&room=${roomCode}`;

  // ── Render ────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <div>
          <div style={{ fontFamily:"Orbitron", fontWeight:900, fontSize:"1.1rem" }}>
            <span style={{ color:"#ffe600", textShadow:"0 0 14px #ffe600" }}>🔔 BUZZER </span>
            <span style={{ color:"#00f5ff",  textShadow:"0 0 14px #00f5ff"  }}>MODE</span>
          </div>
          <div style={{ fontFamily:"Orbitron", fontSize:"0.47rem", color:"#1a2244", letterSpacing:"0.15em", marginTop:3 }}>
            {mqttConn ? "MULTI-DEVICE · PHONES CONNECTED VIA INTERNET" : "SINGLE SCREEN · CONNECTING…"}
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ display:"flex", alignItems:"center", gap:5 }}>
            <div style={{ width:7, height:7, borderRadius:"50%",
              background: mqttConn?"#00ff90":"#ffe600",
              boxShadow: mqttConn?"0 0 8px #00ff90":"0 0 8px #ffe60080",
              animation: mqttConn?"none":"pulse 1s infinite",
            }}/>
            <span style={{ fontFamily:"Orbitron", fontSize:"0.48rem", color:mqttConn?"#00ff90":"#ffe600" }}>
              {mqttConn ? "LIVE" : "CONNECTING"}
            </span>
          </div>
          <button onClick={()=>setShowQR(q=>!q)}
            style={{ ...btn("#ffe600",true), fontSize:"0.55rem" }}>
            {showQR?"HIDE QR":"📱 QR CODES"}
          </button>
        </div>
      </div>

      {/* ── Question Card ── */}
      {currentQ ? (
        <div style={{marginBottom:16}}>
          {/* Public question — shown to audience */}
          <div style={{...card("#ffe60018"),border:"2px solid #ffe60040",position:"relative",marginBottom:8}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <span style={{fontFamily:"Orbitron",fontSize:"0.52rem",color:"#ffe600",letterSpacing:"0.12em"}}>💳 INDIAN PAYMENTS — BUZZ TO ANSWER</span>
              <button onClick={nextQuestion}
                style={{...btn("#252e60",true),fontSize:"0.5rem",padding:"3px 10px"}}>SKIP →</button>
            </div>
            <div style={{fontFamily:"Rajdhani",fontSize:"1.15rem",fontWeight:700,color:"#e0eaff",lineHeight:1.55,marginBottom:showAns?12:0}}>
              {currentQ.q}
            </div>
            {/* Public answer reveal — press only after someone answers */}
            {showAns && (
              <div style={{background:"#00ff9012",border:"1px solid #00ff9040",borderRadius:8,padding:"10px 14px"}}>
                <div style={{fontFamily:"Orbitron",fontSize:"0.5rem",color:"#00ff90",letterSpacing:"0.1em",marginBottom:4}}>✅ CORRECT ANSWER</div>
                <div style={{fontFamily:"Rajdhani",fontSize:"1.05rem",fontWeight:700,color:"#00ff90",marginBottom:6}}>{currentQ.a}</div>
                {currentQ.hint&&<div style={{fontFamily:"Rajdhani",fontSize:"0.82rem",color:"#3a4570"}}>💡 {currentQ.hint}</div>}
              </div>
            )}
          </div>
          {/* Reveal button */}
          {!showAns && (
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setShowAns(true)}
                style={{...btn("#ffe600",true),fontSize:"0.6rem",flex:1}}>
                👁 REVEAL ANSWER TO ALL
              </button>
              <button onClick={openHostPanel}
                style={{...btn("#ff00c8",true),fontSize:"0.6rem",whiteSpace:"nowrap"}}>
                🔒 HOST PANEL
              </button>
            </div>
          )}
        </div>
      ) : (
        <div style={{...card("#ffe60010"),marginBottom:16,textAlign:"center",padding:"18px 16px"}}>
          <div style={{fontFamily:"Orbitron",fontSize:"0.6rem",color:"#3a4060",letterSpacing:"0.12em"}}>💳 INDIAN PAYMENTS ROUND</div>
          <div style={{fontFamily:"Rajdhani",color:"#252e60",fontSize:"0.9rem",marginTop:8}}>Press ▶ START ROUND to load first question</div>
        </div>
      )}

      {/* Room code + QR panel */}
      {showQR && (
        <div style={{ ...card("#ffe60030"), marginBottom:16, padding:"14px 16px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
            <div style={{ fontFamily:"Orbitron", color:"#ffe600", fontSize:"0.6rem", letterSpacing:"0.1em" }}>
              📱 SCAN TO BUZZ FROM PHONE
            </div>
            <div style={{ fontFamily:"Orbitron", fontSize:"0.55rem", letterSpacing:"0.18em",
              color:"#00f5ff", textShadow:"0 0 10px #00f5ff",
              background:"#00f5ff14", border:"1px solid #00f5ff40", borderRadius:4, padding:"3px 10px" }}>
              ROOM: {roomCode}
            </div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))", gap:14 }}>
            {players.map((p, i) => {
              const col = BUZZER_COLORS[i % BUZZER_COLORS.length];
              return (
                <div key={p.id} style={{ textAlign:"center" }}>
                  <div style={{ display:"inline-block", padding:8, background:"#fff", borderRadius:6,
                    border:`3px solid ${col}`, boxShadow:`0 0 14px ${col}40` }}>
                    <QRCodeSVG value={playerUrl(p,i)} size={100} bgColor="#ffffff" fgColor="#07080f" level="M"/>
                  </div>
                  <div style={{ fontFamily:"Orbitron", color:col, fontSize:"0.6rem", marginTop:6, fontWeight:700 }}>{p.name}</div>
                  <div style={{ color:"#252e60", fontSize:"0.55rem", marginTop:2, wordBreak:"break-all" }}>
                    {window.location.hostname}/buzz
                  </div>
                </div>
              );
            })}
          </div>
          {!mqttConn && (
            <div style={{ fontFamily:"Orbitron", color:"#3a3010", fontSize:"0.52rem", marginTop:10, letterSpacing:"0.08em" }}>
              ⚡ CONNECTING TO BROKER… QR CODES WORK ONCE CONNECTED
            </div>
          )}
        </div>
      )}

      {/* Winner banner */}
      {displayPhase === "buzzed" && winPlayer && (
        <div style={{ background:"linear-gradient(135deg,#ffe60018,#00f5ff18)", border:"2px solid #ffe600",
          borderRadius:10, padding:"18px 20px", marginBottom:20, textAlign:"center",
          animation:"pop 0.4s cubic-bezier(0.34,1.56,0.64,1)", boxShadow:"0 0 40px #ffe60050" }}>
          <div style={{ fontSize:"2.2rem", marginBottom:6 }}>🔔</div>
          <div style={{ fontFamily:"Orbitron", fontWeight:900, fontSize:"1.4rem", color:"#ffe600",
            textShadow:"0 0 20px #ffe600", marginBottom:4 }}>{winPlayer.name}</div>
          <div style={{ fontFamily:"Orbitron", color:"#00f5ff", fontSize:"0.65rem", letterSpacing:"0.15em", marginBottom:8 }}>BUZZED IN FIRST!</div>
          <div style={{ fontFamily:"Orbitron", color:"#252e60", fontSize:"0.58rem" }}>⚡ {buzzTime}s reaction time</div>
        </div>
      )}

      {/* Countdown */}
      {displayPhase === "countdown" && (
        <div style={{ textAlign:"center", padding:"28px 0", marginBottom:20 }}>
          <div style={{ fontFamily:"Orbitron", fontWeight:900, fontSize:"6rem", color:"#ffe600",
            textShadow:"0 0 50px #ffe600", animation:"countdownPop 0.35s ease" }}>{cd}</div>
          <div style={{ fontFamily:"Orbitron", color:"#252e60", fontSize:"0.65rem", letterSpacing:"0.2em", marginTop:8 }}>GET READY…</div>
        </div>
      )}

      {/* Ready banner */}
      {displayPhase === "ready" && (
        <div style={{ textAlign:"center", marginBottom:16, padding:"10px 0",
          fontFamily:"Orbitron", color:"#00ff90", fontSize:"0.85rem",
          letterSpacing:"0.25em", animation:"pulse 0.7s ease-in-out infinite",
          textShadow:"0 0 14px #00ff90" }}>
          {mqttConn ? "▶ BUZZ ON PHONE OR TAP BUTTON!" : "▶ TAP YOUR TEAM'S BUTTON!"}
        </div>
      )}

      {/* Buzzer buttons */}
      <div style={{ display:"flex", flexDirection:"column", gap:12, marginBottom:24 }}>
        {players.map((p, i) => {
          const col      = BUZZER_COLORS[i % BUZZER_COLORS.length];
          const isWinner = winner === p.name;
          const isElim   = disabled.includes(p.name);
          const inactive = isElim || (winner && !isWinner) || displayPhase==="countdown" || displayPhase==="idle";
          const clickable = displayPhase==="ready" && !isElim && !winner;

          return (
            <button key={p.id}
              onClick={() => localBuzz(p)}
              disabled={!clickable && !isWinner}
              style={{
                width:"100%", minHeight:90, borderRadius:10,
                border:`3px solid ${isElim?"#1a2040":isWinner?col:col+"80"}`,
                background: isElim?"#07080f":isWinner?`${col}22`:displayPhase==="ready"?`${col}12`:`${col}08`,
                color: isElim?"#1a2040":isWinner?col:inactive?col+"40":col,
                fontFamily:"Orbitron", fontWeight:900, fontSize:"1.2rem", letterSpacing:"0.07em",
                cursor: clickable?"pointer":"default",
                textShadow: isWinner?`0 0 20px ${col}`:"none",
                boxShadow: isWinner?`0 0 30px ${col}60,0 0 70px ${col}30,inset 0 0 30px ${col}20`
                  : displayPhase==="ready"&&!inactive?`0 0 14px ${col}40`:"none",
                animation: isWinner?"buzzWin 0.5s ease,buzzerFlash 0.3s ease 0.5s 3"
                  : displayPhase==="ready"&&!inactive?"readyPulse 1.4s ease-in-out infinite":"none",
                display:"flex", alignItems:"center", gap:16, padding:"0 20px",
                position:"relative", overflow:"hidden", transition:"all 0.18s",
              }}>
              {isWinner && (
                <div style={{ position:"absolute",inset:0,pointerEvents:"none",
                  background:`linear-gradient(180deg,transparent 30%,${col}18 50%,transparent 70%)`,
                  animation:"scanMove 1.2s linear infinite" }}/>
              )}
              <span style={{ fontSize:"1.5rem" }}>{isElim?"✕":isWinner?"🔔":"◉"}</span>
              <div style={{ flex:1, textAlign:"left" }}>
                <div>{p.name}</div>
                <div style={{ fontFamily:"Rajdhani", fontSize:"0.82rem", fontWeight:600, opacity:0.55, marginTop:2 }}>
                  {isElim?"LOCKED OUT THIS ROUND"
                    :isWinner?"BUZZED FIRST!"
                    :displayPhase==="ready"?"TAP TO BUZZ!"
                    :"STANDBY"}
                </div>
              </div>
              <div style={{ fontFamily:"Orbitron", fontSize:"1rem", color:isElim?"#1a2040":col, opacity:isElim?0.3:1 }}>
                {scores[p.id]||0}
              </div>
            </button>
          );
        })}
      </div>

      {/* Host controls */}
      <div style={{ ...card("#1a2040"), marginBottom:18 }}>
        <div style={{ fontFamily:"Orbitron", color:"#252e60", fontSize:"0.58rem", letterSpacing:"0.12em", marginBottom:14 }}>🎙 HOST CONTROLS</div>
        {displayPhase==="idle" && (
          <button onClick={startRound}
            style={{ ...btn("#ffe600"), width:"100%", fontSize:"0.9rem", padding:"18px 0" }}>
            ▶ START ROUND
          </button>
        )}
        {displayPhase==="countdown" && (
          <div style={{ fontFamily:"Orbitron", color:"#252e60", fontSize:"0.7rem", textAlign:"center", padding:"12px 0", letterSpacing:"0.15em" }}>
            COUNTDOWN IN PROGRESS…
          </div>
        )}
        {displayPhase==="ready" && (
          <button onClick={resetAll} style={{ ...btn("#ff4060",true), width:"100%" }}>🔄 ABORT ROUND</button>
        )}
        {displayPhase==="buzzed" && (
          <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
            <button onClick={awardCorrect} style={{ ...btn("#00ff90"), flex:1, fontSize:"0.7rem" }}>✅ CORRECT — +50 pts</button>
            <button onClick={penaliseWrong} style={{ ...btn("#ff4060"), flex:1, fontSize:"0.7rem" }}>❌ WRONG — NEXT TEAM</button>
            <button onClick={resetAll} style={{ ...btn("#252e60",true), width:"100%", fontSize:"0.62rem", marginTop:2 }}>🔄 RESET BUZZERS</button>
          </div>
        )}
      </div>

      {/* Live scores */}
      <div style={{ ...card("#ffe60020"), padding:"12px 16px" }}>
        <div style={{ fontFamily:"Orbitron", color:"#3a4060", fontSize:"0.56rem", letterSpacing:"0.12em", marginBottom:10 }}>LIVE SCORES</div>
        <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
          {[...players].sort((a,b)=>(scores[b.id]||0)-(scores[a.id]||0)).map((p,i)=>{
            const col  = BUZZER_COLORS[players.indexOf(p)%BUZZER_COLORS.length];
            const maxS = Math.max(1,...players.map(x=>scores[x.id]||0));
            return (
              <div key={p.id} style={{ display:"flex", alignItems:"center", gap:10 }}>
                <span style={{ fontFamily:"Orbitron", color:"#252e60", fontSize:"0.6rem", width:18 }}>#{i+1}</span>
                <span style={{ flex:1, fontWeight:600, color:"#c0d0f0" }}>{p.name}</span>
                <div style={{ background:"#070a12", borderRadius:4, padding:"3px 0", width:130, overflow:"hidden" }}>
                  <div style={{ height:6, borderRadius:4, background:col,
                    width:`${Math.min(100,((scores[p.id]||0)/maxS)*100)}%`,
                    transition:"width 0.6s ease", boxShadow:`0 0 8px ${col}60` }}/>
                </div>
                <span style={{ fontFamily:"Orbitron", color:col, fontSize:"0.75rem", minWidth:36, textAlign:"right" }}>{scores[p.id]||0}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────
const EMOJIS=["🔥","👏","😮","🤯","💯","⚡","🚀","🎯","😂","❤️"];

export default function App() {
  const [screen,setScreen]=useState("intro");
  const [players,setPlayers]=useState([{id:1,name:"Team Alpha",score:0},{id:2,name:"Team Beta",score:0},{id:3,name:"Team Gamma",score:0}]);
  const [newName,setNewName]=useState("");
  const [reactions,setReactions]=useState([]);
  const [toast,setToast]=useState(null);
  const [confetti,setConfetti]=useState(false);
  const [iStep,setIStep]=useState(0);
  const [musicOn,setMusicOn]=useState(false);

  function toggleMusic(){ Music.toggle(); setMusicOn(Music.playing()); }

  useEffect(()=>{ if(screen!=="intro") return; let i=0; const t=setInterval(()=>{i++;setIStep(i);if(i>=4)clearInterval(t);},700); return()=>clearInterval(t); },[screen]);

  function toast_(m,d=1600){setToast(m);setTimeout(()=>setToast(null),d);}
  function addS1(pts,ti=0){setPlayers(ps=>ps.map((p,i)=>i===ti?{...p,score:p.score+pts}:p));if(pts>0)toast_(`+${pts} pts! 🎉`);else if(pts<0)toast_(`-${Math.abs(pts)} pts 😬`);}
  function addS2(pts,ti=0){setPlayers(ps=>ps.map((p,i)=>i===ti?{...p,score:p.score+pts}:p));if(pts>0)toast_(`🏆 +${pts} pts!`);}
  function addSB(pts,playerId){setPlayers(ps=>ps.map(p=>p.id===playerId?{...p,score:p.score+pts}:p));}
  function addPlayer(){if(!newName.trim())return;setPlayers(ps=>[...ps,{id:Date.now(),name:newName.trim(),score:0}]);setNewName("");toast_("Added! ✓");}
  function doReact(e){const id=Date.now(),x=Math.random()*80+5;setReactions(r=>[...r,{id,e,x}]);setTimeout(()=>setReactions(r=>r.filter(rx=>rx.id!==id)),2400);}
  function go(s){S.swoosh();setScreen(s);}
  function finale(){S.fanfare();setConfetti(true);setTimeout(()=>setConfetti(false),3500);setScreen("podium");}

  const GameCards=[
    {id:"quiz",icon:"🧠",title:"AI Quiz",sub:"Spin wheel · Lifelines · Streaks",c:"#00f5ff"},
    {id:"aiorhuman",icon:"🤖",title:"AI or Human?",sub:"Dramatic countdown reveal",c:"#ff00c8"},
    {id:"battle",icon:"⚔️",title:"Prompt Battle",sub:"Live typing · AI judges",c:"#ffe600"},
    {id:"buzzer",icon:"🔔",title:"Buzzer Mode",sub:"Indian Payments · Host panel",c:"#00ff90"},
    {id:"lightning",icon:"⚡",title:"Lightning Round",sub:"5-sec timer · Rapid fire · Payments",c:"#ffe600"},
    {id:"logo",icon:"🏷️",title:"Guess the Fintech",sub:"Blur reveal · Brand logos",c:"#ff00c8"},
  ];

  return(
    <>
      <style>{CSS}</style>
      <div className="scanlines"/>
      <Particles/>
      <Confetti on={confetti}/>

      {/* Floating reactions */}
      {reactions.map(r=>(
        <div key={r.id} style={{position:"fixed",left:r.x+"%",bottom:"55px",fontSize:"2.2rem",
          pointerEvents:"none",zIndex:9990,animation:"floatUp 2.2s ease-out both"}}>{r.e}</div>
      ))}

      {/* Toast */}
      {toast&&<div style={{position:"fixed",top:20,right:20,zIndex:99999,
        background:"#00ff9020",border:"2px solid #00ff90",borderRadius:8,
        padding:"12px 24px",fontFamily:"Orbitron",color:"#00ff90",
        fontSize:"0.9rem",fontWeight:700,letterSpacing:"0.1em",
        boxShadow:"0 0 20px #00ff9040",animation:"pop 0.3s ease"}}>{toast}</div>}

      <div style={{maxWidth:760,margin:"0 auto",background:"rgba(7,8,15,0.88)",minHeight:"100vh",
        fontFamily:"Rajdhani,sans-serif",color:"#d0e0ff",position:"relative",zIndex:1}}>

        {/* ── INTRO ── */}
        {screen==="intro"&&(
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"100vh",textAlign:"center",padding:"24px"}}>
            {iStep>=1&&<div style={{fontFamily:"Orbitron",fontSize:"0.65rem",letterSpacing:"0.4em",color:"#1a2244",marginBottom:28,animation:"fadeUp 0.5s ease"}}>✦ WELCOME TO ✦</div>}
            {iStep>=2&&(
              <div style={{animation:"introIn 0.7s cubic-bezier(0.34,1.56,0.64,1)",marginBottom:20}}>
                <div style={{fontFamily:"Orbitron",fontWeight:900}}>
                  <div style={{fontSize:"3.2rem",color:"#00f5ff",textShadow:"0 0 50px #00f5ff,0 0 100px #00f5ff30",lineHeight:1}}>CHITTI</div>
                  <div style={{fontSize:"2.4rem",color:"#ff00c8",textShadow:"0 0 40px #ff00c8,0 0 80px #ff00c830",marginTop:2}}>TECH ARENA</div>
                </div>
                <div style={{fontFamily:"Orbitron",color:"#ffe600",fontSize:"0.85rem",letterSpacing:"0.35em",marginTop:14,textShadow:"0 0 12px #ffe600"}}>TECH GAME SHOW</div>
              </div>
            )}
            {iStep>=3&&<div style={{animation:"fadeUp 0.5s ease",color:"#1a2244",fontFamily:"Orbitron",fontSize:"0.62rem",letterSpacing:"0.15em",marginBottom:36}}>ANNUAL FUNCTION · POWERED BY CLAUDE AI</div>}
            {iStep>=4&&(
              <div style={{animation:"pop 0.6s cubic-bezier(0.34,1.56,0.64,1)"}}>
                <button onClick={()=>{S.fanfare();setConfetti(true);setTimeout(()=>{setConfetti(false);setScreen("hub");},400);}}
                  style={{...btn("#00f5ff"),fontSize:"1rem",padding:"18px 58px",animation:"glowPulse 2s ease infinite",letterSpacing:"0.2em"}}>
                  ▶ START THE SHOW
                </button>
                <div style={{color:"#1a2244",fontFamily:"Orbitron",fontSize:"0.55rem",marginTop:18,letterSpacing:"0.1em"}}>3 games · AI-powered · live audience</div>
              </div>
            )}
          </div>
        )}

        {/* ── HUB ── */}
        {screen==="hub"&&(
          <div>
            <div className="ticker-wrap">
              <div className="ticker-text">★ CHITTI TECH ARENA — AI GAME SHOW ★ POWERED BY CLAUDE AI ★ SPIN THE WHEEL · LIFELINES · PROMPT BATTLES · GRAND FINALE ★ MAY THE BEST TEAM WIN ★ ANNUAL FUNCTION {new Date().getFullYear()} ★</div>
            </div>
            <div style={{padding:"16px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22}}>
                <div>
                  <div style={{fontFamily:"Orbitron",fontWeight:900,fontSize:"1.2rem"}}>
                    <span style={{color:"#00f5ff",textShadow:"0 0 14px #00f5ff"}}>CHITTI </span>
                    <span style={{color:"#ff00c8",textShadow:"0 0 14px #ff00c8"}}>TECH ARENA</span>
                  </div>
                  <div style={{fontFamily:"Orbitron",fontSize:"0.5rem",color:"#1a2244",letterSpacing:"0.15em"}}>ANNUAL FUNCTION · AI GAME SHOW</div>
                </div>
                <div style={{display:"flex",gap:8}}>
                  <button style={{...btn("#00ff90",true),fontSize:"0.52rem"}} onClick={()=>go("teamintro")}>🎬 INTROS</button>
                  <button style={{...btn(musicOn?"#ff4060":"#a855f7",true),fontSize:"0.52rem"}} onClick={toggleMusic}>{musicOn?"🔇 MUSIC":"🎵 MUSIC"}</button>
                  <button style={{...btn("#ffe600",true),fontSize:"0.58rem"}} onClick={finale}>🏆 FINALE</button>
                </div>
              </div>

              {/* Live score */}
              {players.some(p=>p.score>0)&&(
                <div style={{...card("#ffe60020"),marginBottom:16,padding:"12px 16px"}}>
                  <div style={{fontFamily:"Orbitron",color:"#3a4060",fontSize:"0.58rem",marginBottom:8,letterSpacing:"0.1em"}}>LIVE SCORES</div>
                  <div style={{display:"flex",gap:14,flexWrap:"wrap"}}>
                    {[...players].sort((a,b)=>b.score-a.score).map((p,i)=>(
                      <div key={p.id} style={{display:"flex",alignItems:"center",gap:6}}>
                        <span>{"🥇🥈🥉"[i]||"·"}</span>
                        <span style={{fontWeight:600}}>{p.name}</span>
                        <span style={{fontFamily:"Orbitron",color:"#00f5ff",fontSize:"0.75rem"}}>{p.score}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Game cards */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12,marginBottom:20}}>
                {GameCards.map(g=>(
                  <div key={g.id} onClick={()=>go(g.id)}
                    style={{background:"#0d1020",border:"2px solid #1a2040",borderRadius:10,padding:"20px 14px",
                      cursor:"pointer",transition:"all 0.22s",textAlign:"center"}}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor=g.c;e.currentTarget.style.transform="translateY(-6px) scale(1.02)";e.currentTarget.style.boxShadow=`0 12px 32px ${g.c}28`;}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor="#1a2040";e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="none";}}>
                    <div style={{fontSize:"2.2rem",marginBottom:10,animation:"float 3s ease-in-out infinite"}}>{g.icon}</div>
                    <div style={{fontFamily:"Orbitron",color:g.c,fontSize:"0.72rem",marginBottom:7}}>{g.title}</div>
                    <div style={{color:"#252e60",fontSize:"0.82rem",lineHeight:1.5,marginBottom:14}}>{g.sub}</div>
                    <div style={{fontFamily:"Orbitron",fontSize:"0.54rem",letterSpacing:"0.1em",padding:"5px 12px",border:`1px solid ${g.c}`,borderRadius:4,color:g.c,background:`${g.c}15`,display:"inline-block"}}>PLAY →</div>
                  </div>
                ))}
              </div>

              {/* Players */}
              <div style={{...card(),marginBottom:18}}>
                <div style={{fontFamily:"Orbitron",color:"#00ff90",fontSize:"0.65rem",marginBottom:14,letterSpacing:"0.1em"}}>👥 TEAMS & PLAYERS</div>
                <div style={{display:"flex",gap:10,marginBottom:12}}>
                  <input type="text" placeholder="Add team or player name…" value={newName}
                    onChange={e=>setNewName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addPlayer()}
                    style={{background:"#070a12",border:"1.5px solid #1a2040",borderRadius:6,color:"#c0d8f8",
                      fontFamily:"Rajdhani",fontSize:"1rem",padding:"10px 14px",flex:1,outline:"none",transition:"border-color 0.2s"}}
                    onFocus={e=>e.target.style.borderColor="#00f5ff"} onBlur={e=>e.target.style.borderColor="#1a2040"}/>
                  <button style={{...btn("#00ff90",true),whiteSpace:"nowrap"}} onClick={addPlayer}>+ Add</button>
                </div>
                <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                  {players.map(p=>(
                    <div key={p.id} style={{padding:"5px 12px",borderRadius:20,border:"1px solid #1a2040",
                      background:"#070a12",fontSize:"0.9rem",display:"flex",alignItems:"center",gap:8}}>
                      <span>{p.name}</span>
                      <span style={{fontFamily:"Orbitron",color:"#00f5ff",fontSize:"0.65rem"}}>{p.score}</span>
                      <span style={{cursor:"pointer",color:"#1a2040",fontSize:"0.8rem"}} onClick={()=>setPlayers(ps=>ps.filter(x=>x.id!==p.id))}>✕</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Reactions */}
              <div style={{display:"flex",gap:7,justifyContent:"center",flexWrap:"wrap"}}>
                {EMOJIS.map(e=>(
                  <button key={e} onClick={()=>doReact(e)}
                    style={{fontSize:"1.5rem",background:"none",border:"1.5px solid #1a2040",borderRadius:8,
                      padding:"7px 10px",cursor:"pointer",transition:"all 0.15s"}}
                    onMouseEnter={ev=>{ev.currentTarget.style.transform="scale(1.3)";ev.currentTarget.style.background="#ffffff10";ev.currentTarget.style.borderColor="#ffffff20";}}
                    onMouseLeave={ev=>{ev.currentTarget.style.transform="none";ev.currentTarget.style.background="none";ev.currentTarget.style.borderColor="#1a2040";}}>
                    {e}
                  </button>
                ))}
              </div>
              <div style={{textAlign:"center",marginTop:20,fontFamily:"Orbitron",fontSize:"0.48rem",letterSpacing:"0.18em",color:"#0f1224"}}>
                CHITTI TECH ARENA · POWERED BY CLAUDE AI · {new Date().getFullYear()}
              </div>
            </div>
          </div>
        )}

        {/* ── GAME SCREENS ── */}
        {screen==="teamintro"&&(
          <div style={{padding:"14px 16px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <div style={{fontFamily:"Orbitron",fontWeight:900,fontSize:"1rem"}}>
                <span style={{color:"#00f5ff"}}>CHITTI </span><span style={{color:"#ff00c8"}}>TECH ARENA</span>
              </div>
              <button onClick={()=>go("hub")} style={{...btn("#00f5ff",true),fontSize:"0.58rem"}}>← HUB</button>
            </div>
            <TeamIntro players={players} onDone={()=>go("hub")}/>
          </div>
        )}

        {["quiz","aiorhuman","battle","buzzer","lightning","logo"].includes(screen)&&(
          <div>
            <div className="ticker-wrap">
              <div className="ticker-text">★ CHITTI TECH ARENA — AI GAME SHOW ★ ANNUAL FUNCTION {new Date().getFullYear()} ★ POWERED BY CLAUDE AI ★</div>
            </div>
            <div style={{padding:"14px 16px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
                <div style={{fontFamily:"Orbitron",fontWeight:900,fontSize:"1rem"}}>
                  <span style={{color:"#00f5ff"}}>CHITTI </span><span style={{color:"#ff00c8"}}>TECH ARENA</span>
                </div>
                <button onClick={()=>go("hub")} style={{...btn("#00f5ff",true),fontSize:"0.58rem"}}>← HUB</button>
              </div>
              {screen==="quiz"&&<QuizGame players={players} onAddScore={addS1} onDone={()=>go("hub")}/>}
              {screen==="aiorhuman"&&<AiOrHuman players={players} onAddScore={addS1} onDone={()=>go("hub")}/>}
              {screen==="battle"&&<PromptBattle players={players} onAddScore={addS2} onDone={()=>go("hub")}/>}
              {screen==="buzzer"&&<BuzzerMode players={players} onAddScore={addSB} onDone={()=>go("hub")}/>}
              {screen==="lightning"&&<LightningRound players={players} onAddScore={addS1} onDone={finale}/>}
              {screen==="logo"&&<LogoRound players={players} onAddScore={addS1} onDone={finale}/>}
              {/* Reaction bar */}
              <div style={{display:"flex",gap:6,justifyContent:"center",marginTop:20,flexWrap:"wrap",borderTop:"1px solid #1a2040",paddingTop:14}}>
                {EMOJIS.slice(0,8).map(e=>(
                  <button key={e} onClick={()=>doReact(e)}
                    style={{fontSize:"1.4rem",background:"none",border:"1.5px solid #1a2040",borderRadius:8,padding:"6px 10px",cursor:"pointer",transition:"all 0.15s"}}
                    onMouseEnter={ev=>{ev.currentTarget.style.transform="scale(1.28)";}}
                    onMouseLeave={ev=>{ev.currentTarget.style.transform="none";}}>
                    {e}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── PODIUM ── */}
        {screen==="podium"&&(
          <div style={{padding:"20px 16px"}}>
            <Confetti on={confetti}/>
            <Podium players={players}/>
            <div style={{display:"flex",gap:12,justifyContent:"center",marginTop:28,flexWrap:"wrap"}}>
              <button style={btn("#00f5ff")} onClick={()=>{setPlayers(ps=>ps.map(p=>({...p,score:0})));go("hub");toast_("New game! Scores reset ↺");}}>↺ NEW GAME</button>
              <button style={btn("#ffe600",true)} onClick={()=>go("hub")}>← BACK TO HUB</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
