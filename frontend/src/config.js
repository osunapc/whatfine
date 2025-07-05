function getConfig(name, defaultValue=null) {
    // If inside a docker container, use window.ENV
    if( window.ENV !== undefined ) {
        return window.ENV[name] || defaultValue;
    }

    // En Vite, las variables de entorno se acceden a través de import.meta.env
    // y deben tener el prefijo VITE_ para ser expuestas al cliente.
    // La lógica de window.ENV se mantiene por si sigue siendo relevante en Docker.
    return import.meta.env[name] || defaultValue;
}

export function getBackendUrl() {
    // Primero intentar con window.ENV como antes, luego con import.meta.env
    if (window.ENV !== undefined && window.ENV['REACT_APP_BACKEND_URL'] !== undefined) {
        return window.ENV['REACT_APP_BACKEND_URL'];
    }
    return import.meta.env.VITE_BACKEND_URL || null; // Retornar null si no está definida
}

export function getHoursCloseTicketsAuto() {
    // Primero intentar con window.ENV como antes, luego con import.meta.env
    if (window.ENV !== undefined && window.ENV['REACT_APP_HOURS_CLOSE_TICKETS_AUTO'] !== undefined) {
        return window.ENV['REACT_APP_HOURS_CLOSE_TICKETS_AUTO'];
    }
    return import.meta.env.VITE_HOURS_CLOSE_TICKETS_AUTO || null; // Retornar null o un valor por defecto apropiado
}