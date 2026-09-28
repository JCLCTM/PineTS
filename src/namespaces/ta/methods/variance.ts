// SPDX-License-Identifier: AGPL-3.0-only

import { Series } from '../../../Series';

export function variance(context: any) {
    return (source: any, _length: any, ...rest: any[]) => {
        // The transpiler appends the call id after the optional `biased` argument.
        const _callId: string | undefined = typeof rest[rest.length - 1] === 'string' ? rest.pop() : undefined;
        const length = Series.from(_length).get(0);
        const biased = rest.length === 0 || !!Series.from(rest[0]).get(0);

        // Variance calculation
        if (!context.taState) context.taState = {};
        const stateKey = _callId || `variance_${length}_${biased}`;

        if (!context.taState[stateKey]) {
            context.taState[stateKey] = { 
                lastIdx: -1,
                // Committed state
                prevWindow: [],
                prevCallCount: 0,
                // Tentative state
                currentWindow: [],
                currentCallCount: 0
            };
        }

        const state = context.taState[stateKey];

        // Commit logic
        if (context.idx > state.lastIdx) {
            if (state.lastIdx >= 0) {
                state.prevWindow = [...state.currentWindow];
                state.prevCallCount = state.currentCallCount;
            }
            state.lastIdx = context.idx;
        }

        const currentValue = Series.from(source).get(0);
        
        const window = [...state.prevWindow];
        window.unshift(currentValue);

        while (window.length > length) {
            window.pop();
        }

        // Track actual call count for callsite-correct backfill
        const callCount = state.prevCallCount + 1;
        if (window.length < length && (callCount >= length || context.idx >= length - 1)) {
            const series = Series.from(source);
            while (window.length < length) {
                window.push(series.get(window.length));
            }
        }

        state.currentWindow = window;
        state.currentCallCount = callCount;

        if (window.length < length) {
            return NaN;
        }

        let sum = 0;
        let sumSquares = 0;
        for (let i = 0; i < length; i++) {
            sum += window[i];
            sumSquares += window[i] * window[i];
        }

        const mean = sum / length;
        const biasedVariance = sumSquares / length - mean * mean;
        const variance = biased ? biasedVariance : (biasedVariance * length) / (length - 1);

        return context.precision(variance);
    };
}
