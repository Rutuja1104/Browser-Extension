class EventEmitter {
    constructor() {
        this.events = {};
    }

    on(eventName, listener) {
        if (!this.events[eventName]) {
            this.events[eventName] = [];
        }
        this.events[eventName].push(listener);
    }

    publish(eventName, ...args) {
        if (this.events[eventName]) {
            this.events[eventName].forEach(listener => {
                listener(...args);
            });
        }
    }

    off(eventName, listener) {
        if (this.events[eventName]) {
            this.events[eventName] = this.events[eventName].filter(fn => fn !== listener);
        }
    }
}

export const myEmitter = new EventEmitter();
