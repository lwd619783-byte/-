import assert from 'node:assert/strict';
import { validateReview } from '../../shared/daily-review.mjs';
import { reviewTools } from '../../server/daily-review/mcp.mjs';
import { reviewFixture } from '../tests/daily-review.fixture.mjs';
validateReview(reviewFixture());
assert.throws(()=>validateReview({...reviewFixture(),schemaVersion:'daily-review.v2'}));
assert.deepEqual(Object.keys(reviewTools),['get_daily_review_context','get_daily_review','get_daily_review_history','prepare_daily_review','publish_daily_review']);
console.log('Daily Review V1 contract / scoped write lane: PASS (synthetic)');
