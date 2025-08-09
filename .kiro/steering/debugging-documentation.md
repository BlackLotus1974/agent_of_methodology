---
inclusion: always
---

# Debugging Documentation Guidelines

## Purpose
Systematic documentation of problem-solving processes to create a knowledge base for improving debugging efficiency and learning from past issues.

## Documentation Requirements

### Log File Structure
- **File**: `debugging_log.jsonl` (root directory)
- **Format**: JSONL (one JSON object per line)
- **Encoding**: UTF-8

### Required Log Entry Schema
```json
{
  "timestamp": "ISO 8601 format",
  "session_id": "unique_identifier",
  "problem": {
    "title": "Brief problem description",
    "description": "Detailed problem context",
    "error_messages": ["Exact error messages"],
    "context": "Where/when the issue occurred",
    "severity": "low|medium|high|critical"
  },
  "solution": {
    "status": "successful|failed|partial",
    "description": "Solution approach and outcome",
    "code_changes": ["List of file changes made"],
    "time_invested": "Minutes spent",
    "approach": "Methodology used"
  },
  "thinking_process": {
    "initial_hypothesis": "First assumption about the cause",
    "investigation_steps": ["Ordered list of debugging steps"],
    "dead_ends": ["Approaches that didn't work"],
    "breakthrough_moment": "Key insight that led to solution",
    "alternative_approaches": ["Other methods considered"]
  },
  "lessons_learned": {
    "what_worked": "Effective techniques",
    "what_didnt_work": "Ineffective approaches",
    "time_wasters": ["Activities that consumed time unnecessarily"],
    "efficiency_tips": ["Future optimization suggestions"],
    "prevention": "How to avoid similar issues"
  },
  "tags": ["Categorization tags"],
  "difficulty_level": "1-5 scale",
  "tools_used": ["Development tools utilized"]
}
```

## When to Document

**Always log after:**
- Resolving any bug or issue (regardless of complexity)
- Spending >30 minutes on a problem without resolution
- Discovering new debugging techniques
- Making mistakes that waste significant time
- OpenAI Agents SDK related issues
- React/TypeScript compilation errors
- WebRTC connection problems
- Browser compatibility issues

## Project-Specific Debugging Patterns

### Common Agent of Methodology Issues
- **OpenAI Agents SDK**: Document browser compatibility problems, WebRTC issues
- **WebRTC**: Log connection race conditions, data channel errors
- **React Hooks**: Record custom hook debugging (useRealtimeSession, useTranscript)
- **Browser Shims**: Document Node.js polyfill requirements
- **TypeScript**: Log type definition problems and resolution strategies

### Debugging Workflow
1. **Immediate logging**: Start session entry when problem identified
2. **Real-time updates**: Log investigation steps as they happen
3. **Solution documentation**: Complete entry immediately after resolution
4. **Reflection**: Add lessons learned while context is fresh

## AI Assistant Guidelines

When debugging issues:
1. **Check existing logs**: Review `debugging_log.jsonl` for similar problems
2. **Document systematically**: Follow the schema exactly
3. **Be specific**: Include exact error messages, file paths, line numbers
4. **Track time**: Note investigation duration for efficiency analysis
5. **Learn patterns**: Identify recurring issues in the codebase

### OpenAI Agents SDK Debugging
- Always check browser console for WebRTC errors
- Verify connection state before sending messages
- Test with different browsers for compatibility issues
- Document shim requirements for Node.js APIs

### React/TypeScript Debugging
- Include component hierarchy context
- Document hook dependency issues
- Note TypeScript compilation errors with exact messages
- Track prop drilling and state management problems

## Efficiency Rules

1. **Document immediately** - Don't postpone logging
2. **Be honest** - Include failed attempts and mistakes
3. **Detail thinking** - Record the complete thought process
4. **Categorize consistently** - Use standardized tags
5. **Review regularly** - Check past logs before tackling similar issues
6. **Update prevention strategies** - Refine based on recurring patterns

The goal is creating a comprehensive debugging knowledge base that improves problem-solving efficiency and prevents repeated mistakes in the Agent of Methodology codebase.