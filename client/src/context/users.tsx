export interface User {
    userId: Number;
    coordinates: {
        lat: number;
        lng: number;
    };
    type: string;
    username: string | undefined;
    email: string;
    active: boolean;
}

export const usersData = [
    {
        userId: 1,
        coordinates: {
            lat: 37.942127583678776,
            lng: 23.714480156086637
        },
        username: 'Serena Rodriguez',
        type: 'user',
        email: "serena@example.com",
        active: true
    },
    {
        userId: 2,
        coordinates: {
            lat: 37.987086035192384,
            lng: 23.726866021570746
        },
        username: 'Maya Patel',
        type: 'user',
        email: "mayab@example.com",
        active: true
    },
    {
        userId: 3,
        coordinates: {
            lat: 37.9335636650263,
            lng: 23.755277420683132
        },
        username: 'Isaac Ramirez',
        type: 'user', // user, shop, event
        email: "isaac@example.com",
        active: true
    },
    {
        userId: 4,
        coordinates: {
            lat: 37.957637371954576,
            lng: 23.72953503331404
        },
        username: 'Lambda Project',
        type: 'shop', // user, shop, event
        email: "lamda.project@example.com",
        active: true
    },
    {
        userId: 5,
        coordinates: {
            lat: 37.959311695128626,
            lng: 23.706172718146803
        },
        username: 'Nothing shop',
        type: 'shop', // user, shop, event
        email: "empty@example.com",
        active: false
    }
]