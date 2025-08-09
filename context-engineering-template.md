# Context Engineering Template: Agent of Methodology

## Header Section

### Title
**Atchalta Knowledge Development Methodology - AI Agent Context Engineering Framework**

### Purpose
This template provides a systematic approach to context engineering for the Agent of Methodology application, which implements the Atchalta knowledge development process through dual AI agents (Theory Mentor and Methodology Mentor) using OpenAI's Realtime Agents SDK.

### Key Principles
1. **Doc-First Policy**: All agent responses must be grounded in the Atchalta Field Guide
2. **Abductive Reasoning**: Maintain exploratory thinking, avoid premature justification
3. **Stage-Sequential Process**: Follow Framing → Discovery → Abstraction → Mapping → Enrichment → Calibration
4. **Multi-Modal Integration**: Support voice conversation and visual analysis of mind maps
5. **Real-Time Collaboration**: Enable seamless handoffs between theory and methodology agents

## Context Components Checklist

### 1. Instructions ✅
**Current Implementation:**
- **Theory Mentor**: Focused on "why" - explains theoretical concepts, maintains abductive mode
- **Methodology Mentor**: Focused on "how" - provides step-by-step guidance through stages
- **Doc-First Policy**: Both agents must call `reference_read("Atchalta_FieldGuide.md")` on first turn
- **Handoff Rules**: Clear triggers for agent switching based on query type

**Quality Assessment:**
- ✅ Role clarity and boundaries well-defined
- ✅ Behavioral constraints (tone, response length) specified
- ✅ Knowledge grounding requirements explicit
- ⚠️ Could benefit from more specific error handling instructions

### 2. User Prompt ✅
**Current Implementation:**
- **Voice Input**: Real-time speech-to-text via WebRTC
- **Text Input**: Traditional chat interface with message queuing
- **Image Upload**: Sensemaker map screenshot analysis
- **Stage Identification**: Methodology Mentor prompts for current stage

**Quality Assessment:**
- ✅ Multi-modal input support
- ✅ Context-aware prompting based on methodology stage
- ✅ Upload validation and error handling
- ✅ Connection state management prevents race conditions

### 3. State/History ✅
**Current Implementation:**
- **Transcript Context**: Full conversation history with timestamps
- **Session History**: WebRTC session management with event logging
- **Agent Handoff Tracking**: Maintains context across agent switches
- **Tool Execution History**: Breadcrumb logging of function calls

**Quality Assessment:**
- ✅ Comprehensive conversation state management
- ✅ Real-time updates with delta handling
- ✅ Persistent session context across handoffs
- ✅ Structured logging for debugging and analysis

### 4. Long-term Memory ✅
**Current Implementation:**
- **Field Guide Caching**: Agents cache outline after first read, re-read sections as needed
- **Stage Progress Tracking**: Methodology Mentor tracks user's current stage
- **Artifact Management**: Requests and tracks missing artifacts (raw text, concepts, maps)
- **Insight Accumulation**: Builds on previous insights across sessions

**Quality Assessment:**
- ✅ Knowledge base integration with caching strategy
- ✅ Progressive context building across methodology stages
- ⚠️ Limited cross-session persistence (browser-based)
- ⚠️ Could benefit from user profile/preference storage

### 5. Retrieved Information ✅
**Current Implementation:**
- **Reference Read Tool**: Fetches Atchalta Field Guide content on demand
- **Vision Analysis Tool**: Extracts structured data from mind map screenshots
- **Dynamic Content Loading**: Targeted section retrieval based on current stage
- **Citation Requirements**: All responses must cite Field Guide sections

**Quality Assessment:**
- ✅ Authoritative knowledge source integration
- ✅ Multi-modal information retrieval (text + vision)
- ✅ Proper citation and attribution mechanisms
- ✅ Error handling for failed retrievals

### 6. Available Tools ✅
**Current Implementation:**
- **reference_read**: Loads Field Guide content with path sanitization
- **sensemaker_vision_read**: Analyzes mind map images using GPT-4o-mini vision
- **sensemaker_note**: Normalizes text for concept mapping
- **sensemaker_cluster_hint**: Suggests concept clustering approaches
- **Moderation Guardrails**: Content filtering for appropriate responses

**Quality Assessment:**
- ✅ Comprehensive tool suite for methodology support
- ✅ Proper input validation and error handling
- ✅ Integration with external APIs (vision, responses)
- ✅ Security measures (path sanitization, content moderation)

### 7. Structured Output ✅
**Current Implementation:**
- **Stage-Specific Guidance**: Tailored micro-instructions for each methodology stage
- **Concrete Next Actions**: Every response ends with specific next step
- **Success Criteria**: Clear completion indicators for each task
- **Citation Format**: Standardized Field Guide references [Field Guide: Section]
- **JSON Tool Responses**: Structured data from vision and clustering tools

**Quality Assessment:**
- ✅ Consistent output formatting across agents
- ✅ Actionable guidance with clear success metrics
- ✅ Proper citation and attribution
- ✅ Structured data for tool integrations

## Planning Framework

### Step 1: Context Architecture Design
1. **Agent Role Definition**: Define Theory vs Methodology mentor boundaries
2. **Knowledge Base Integration**: Establish doc-first policy and caching strategy
3. **Tool Ecosystem**: Design supporting tools for each methodology stage
4. **Handoff Mechanisms**: Create seamless agent switching logic

### Step 2: Multi-Modal Integration
1. **Voice Interface**: Implement WebRTC for real-time conversation
2. **Visual Analysis**: Add vision capabilities for mind map interpretation
3. **Text Processing**: Support traditional chat with message queuing
4. **State Synchronization**: Maintain context across all input modalities

### Step 3: Knowledge Grounding
1. **Reference Document**: Integrate authoritative Field Guide
2. **Citation Requirements**: Enforce source attribution in all responses
3. **Dynamic Loading**: Implement targeted content retrieval
4. **Validation Mechanisms**: Ensure response accuracy against source

### Step 4: Process Flow Management
1. **Stage Tracking**: Monitor user progress through methodology stages
2. **Artifact Management**: Track required inputs for each stage
3. **Quality Gates**: Prevent stage skipping, ensure completeness
4. **Progress Indicators**: Provide clear advancement criteria

### Step 5: Error Handling & Recovery
1. **Connection Management**: Robust WebRTC state handling
2. **Tool Failure Recovery**: Graceful degradation for failed operations
3. **Content Moderation**: Guardrails for appropriate responses
4. **User Feedback**: Clear error messages and recovery suggestions

## Quality Assessment Criteria

### Context Completeness (9/10)
- ✅ All 7 context components implemented
- ✅ Multi-modal input support
- ✅ Comprehensive tool ecosystem
- ⚠️ Limited cross-session persistence

### Knowledge Grounding (10/10)
- ✅ Authoritative source integration
- ✅ Mandatory citation requirements
- ✅ Dynamic content loading
- ✅ Validation against Field Guide

### Process Fidelity (9/10)
- ✅ Accurate methodology implementation
- ✅ Stage-sequential enforcement
- ✅ Proper handoff mechanisms
- ⚠️ Could improve stage transition validation

### Technical Robustness (8/10)
- ✅ WebRTC race condition fixes
- ✅ Browser compatibility solutions
- ✅ Comprehensive error handling
- ⚠️ Some remaining API stability issues

### User Experience (9/10)
- ✅ Intuitive multi-modal interface
- ✅ Real-time feedback and status
- ✅ Clear guidance and next steps
- ✅ Visual progress indicators

## Example Scenarios

### Scenario 1: New User Onboarding
**Context Setup:**
- User arrives at Framing stage
- No prior session history
- Methodology Mentor active
- Field Guide not yet loaded

**Expected Flow:**
1. Agent loads Field Guide on first turn
2. Prompts for stage identification
3. Provides Framing stage micro-instructions
4. Requests raw text input with emotional associations

### Scenario 2: Mind Map Analysis
**Context Setup:**
- User at Mapping stage
- Has uploaded Sensemaker screenshot
- Vision tool available
- Previous concepts identified

**Expected Flow:**
1. Vision tool extracts nodes, clusters, connections
2. Agent analyzes against Field Guide principles
3. Identifies 2-3 key insights
4. Suggests next Sensemaker step

### Scenario 3: Theory Clarification
**Context Setup:**
- User asks "why" question about methodology
- Currently with Methodology Mentor
- Needs theoretical grounding

**Expected Flow:**
1. Methodology Mentor triggers handoff
2. Theory Mentor loads relevant Field Guide section
3. Provides concise theoretical explanation
4. Offers to return to methodology guidance

### Scenario 4: Error Recovery
**Context Setup:**
- WebRTC connection drops during conversation
- User has pending message
- Upload in progress

**Expected Flow:**
1. Connection status indicator updates
2. Message queued for retry
3. Upload blocked with clear feedback
4. Automatic retry on reconnection

## Implementation Notes

### Best Practices
1. **Always Check Connection State**: Gate all actions on WebRTC status
2. **Implement Message Queuing**: Handle disconnected state gracefully
3. **Use Browser Shims**: Ensure OpenAI agents compatibility
4. **Validate All Inputs**: Sanitize file uploads and user content
5. **Provide Clear Feedback**: Use breadcrumbs and status indicators
6. **Cache Strategically**: Load Field Guide once, reuse across session
7. **Cite Consistently**: Always reference source material
8. **Handle Errors Gracefully**: Provide recovery options for failures

### Common Pitfalls
1. **Race Conditions**: WebRTC actions before connection established
2. **Missing Citations**: Responses without Field Guide references
3. **Stage Skipping**: Allowing progression without completion
4. **Tool Failures**: Not handling API errors gracefully
5. **Context Loss**: Losing state during agent handoffs
6. **Browser Compatibility**: Node.js API assumptions in browser
7. **Memory Leaks**: Not cleaning up WebRTC resources
8. **Input Validation**: Accepting unsafe file uploads or content

### Technical Considerations
1. **WebRTC Management**: Robust connection state handling
2. **Browser Polyfills**: Comprehensive Node.js API shims
3. **Webpack Configuration**: Proper module resolution for agents library
4. **Error Boundaries**: React error handling for graceful degradation
5. **Performance**: Efficient caching and lazy loading strategies
6. **Security**: Input sanitization and content moderation
7. **Accessibility**: Multi-modal interface considerations
8. **Scalability**: Session management and resource cleanup

### Future Enhancements
1. **Cross-Session Persistence**: User profiles and progress tracking
2. **Advanced Analytics**: Methodology effectiveness metrics
3. **Collaborative Features**: Multi-user session support
4. **Enhanced Vision**: More sophisticated mind map analysis
5. **Mobile Optimization**: Touch-friendly interface adaptations
6. **Offline Capabilities**: Local caching for disconnected use
7. **Integration APIs**: External tool connectivity
8. **Customization**: User-specific methodology adaptations

---

*This template serves as a comprehensive guide for context engineering in the Agent of Methodology application, ensuring consistent, high-quality AI agent interactions grounded in the Atchalta knowledge development methodology.*