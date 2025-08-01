# plugins: Admin
URL: /docs/plugins/admin
Source: https://raw.githubusercontent.com/better-auth/better-auth/refs/heads/main/docs/content/docs/plugins/admin.mdx

Admin plugin for Better Auth
        
***

title: Admin
description: Admin plugin for Better Auth
-----------------------------------------

The Admin plugin provides a set of administrative functions for user management in your application. It allows administrators to perform various operations such as creating users, managing user roles, banning/unbanning users, impersonating users, and more.

## Installation

<Steps>
  <Step>
    ### Add the plugin to your auth config

    To use the Admin plugin, add it to your auth config.

    ```ts title="auth.ts"
    import { betterAuth } from "better-auth"
    import { admin } from "better-auth/plugins" // [!code highlight]

    export const auth = betterAuth({
        // ... other config options
        plugins: [
            admin() // [!code highlight]
        ]
    })
    ```
  </Step>

  <Step>
    ### Migrate the database

    Run the migration or generate the schema to add the necessary fields and tables to the database.

    <Tabs items={["migrate", "generate"]}>
      <Tab value="migrate">
        ```bash
        npx @better-auth/cli migrate
        ```
      </Tab>

      <Tab value="generate">
        ```bash
        npx @better-auth/cli generate
        ```
      </Tab>
    </Tabs>

    See the [Schema](#schema) section to add the fields manually.
  </Step>

  <Step>
    ### Add the client plugin

    Next, include the admin client plugin in your authentication client instance.

    ```ts title="auth-client.ts"
    import { createAuthClient } from "better-auth/client"
    import { adminClient } from "better-auth/client/plugins"

    export const authClient = createAuthClient({
        plugins: [
            adminClient()
        ]
    })
    ```
  </Step>
</Steps>

## Usage

Before performing any admin operations, the user must be authenticated with an admin account. An admin is any user assigned the `admin` role or any user whose ID is included in the `adminUserIds` option.

### Create User

Allows an admin to create a new user.

<APIMethod path="/admin/create-user" method="POST" resultVariable="newUser">
  ```ts
  type createUser = {
      /**
       * The email of the user. 
       */
      email: string = "user@example.com"
      /**
       * The password of the user. 
       */
      password: string = "some-secure-password"
      /**
       * The name of the user. 
       */
      name: string = "James Smith"
      /**
       * A string or array of strings representing the roles to apply to the new user. 
       */
      role?: string | string[] = "user"
      /**
       * Extra fields for the user. Including custom additional fields. 
       */
      data?: Record<string, any> = { customField: "customValue" }
  }
  ```
</APIMethod>

### List Users

Allows an admin to list all users in the database.

<APIMethod path="/admin/list-users" method="GET" requireSession note={"All properties are optional to configure. By default, 100 rows are returned, you can configure this by the `limit` property."} resultVariable={"users"}>
  ```ts
  type listUsers = {
      /**
       * The value to search for. 
       */
      searchValue?: string = "some name"
      /**
       * The field to search in, defaults to email. Can be `email` or `name`. 
       */
      searchField?: "email" | "name" = "name"
      /**
       * The operator to use for the search. Can be `contains`, `starts_with` or `ends_with`. 
       */
      searchOperator?: "contains" | "starts_with" | "ends_with" = "contains"
      /**
       * The number of users to return. Defaults to 100.
       */
      limit?: string | number = 100
      /**
       * The offset to start from. 
       */
      offset?: string | number = 100
      /**
       * The field to sort by. 
       */
      sortBy?: string = "name"
      /**
       * The direction to sort by. 
       */
      sortDirection?: "asc" | "desc" = "desc"
      /**
       * The field to filter by. 
       */
      filterField?: string = "email"
      /**
       * The value to filter by. 
       */
      filterValue?: string | number | boolean = "hello@example.com"
      /**
       * The operator to use for the filter. 
       */
      filterOperator?: "eq" | "ne" | "lt" | "lte" | "gt" | "gte" = "eq"
  }
  ```
</APIMethod>

#### Query Filtering

The `listUsers` function supports various filter operators including `eq`, `contains`, `starts_with`, and `ends_with`.

#### Pagination

The `listUsers` function supports pagination by returning metadata alongside the user list. The response includes the following fields:

```ts
{
  users: User[],   // Array of returned users
  total: number,   // Total number of users after filters and search queries
  limit: number | undefined,   // The limit provided in the query
  offset: number | undefined   // The offset provided in the query
}
```

##### How to Implement Pagination

To paginate results, use the `total`, `limit`, and `offset` values to calculate:

* **Total pages:** `Math.ceil(total / limit)`
* **Current page:** `(offset / limit) + 1`
* **Next page offset:** `Math.min(offset + limit, (total - 1))` – The value to use as `offset` for the next page, ensuring it does not exceed the total number of pages.
* **Previous page offset:** `Math.max(0, offset - limit)` – The value to use as `offset` for the previous page (ensuring it doesn’t go below zero).

##### Example Usage

Fetching the second page with 10 users per page:

```ts title="admin.ts"
const pageSize = 10;
const currentPage = 2;

const users = await authClient.admin.listUsers({
    query: {
        limit: pageSize,
        offset: (currentPage - 1) * pageSize
    }
});

const totalUsers = users.total;
const totalPages = Math.ceil(totalUsers / limit)
```

### Set User Role

Changes the role of a user.

<APIMethod path="/admin/set-role" method="POST" requireSession>
  ```ts
  type setRole = {
      /**
       * The user id which you want to set the role for.
       */
      userId?: string = "user-id"
      /**
       * The role to set, this can be a string or an array of strings. 
       */
      role: string | string[] = "admin"
  }
  ```
</APIMethod>

### Set User Password

Changes the password of a user.

<APIMethod path="/admin/set-user-password" method="POST" requireSession>
  ```ts
  type setUserPassword = {
      /**
       * The new password. 
       */
      newPassword: string = 'new-password'
      /**
       * The user id which you want to set the password for.
       */
      userId: string = 'user-id'
  }
  ```
</APIMethod>

### Ban User

Bans a user, preventing them from signing in and revokes all of their existing sessions.

<APIMethod path="/admin/ban-user" method="POST" requireSession noResult>
  ```ts
  type banUser = {
      /**
       * The user id which you want to ban.
       */
      userId: string = "user-id"
      /**
       * The reason for the ban. 
       */
      banReason?: string = "Spamming"
      /**
       * The number of seconds until the ban expires. If not provided, the ban will never expire. 
       */
      banExpiresIn?: number = 60 * 60 * 24 * 7
  }
  ```
</APIMethod>

### Unban User

Removes the ban from a user, allowing them to sign in again.

<APIMethod path="/admin/unban-user" method="POST" requireSession noResult>
  ```ts
  type unbanUser = {
      /**
       * The user id which you want to unban.
       */
      userId: string = "user-id"
  }
  ```
</APIMethod>

### List User Sessions

Lists all sessions for a user.

<APIMethod path="/admin/list-user-sessions" method="POST" requireSession>
  ```ts
  type listUserSessions = {
      /**
       * The user id. 
       */
      userId: string = "user-id"
  }
  ```
</APIMethod>

### Revoke User Session

Revokes a specific session for a user.

<APIMethod path="/admin/revoke-user-session" method="POST" requireSession>
  ```ts
  type revokeUserSession = {
      /**
       * The session token which you want to revoke. 
       */
      sessionToken: string = "session_token_here"
  }
  ```
</APIMethod>

### Revoke All Sessions for a User

Revokes all sessions for a user.

<APIMethod path="/admin/revoke-user-sessions" method="POST" requireSession>
  ```ts
  type revokeUserSessions = {
      /**
       * The user id which you want to revoke all sessions for. 
       */
      userId: string = "user-id"
  }
  ```
</APIMethod>

### Impersonate User

This feature allows an admin to create a session that mimics the specified user. The session will remain active until either the browser session ends or it reaches 1 hour. You can change this duration by setting the `impersonationSessionDuration` option.

<APIMethod path="/admin/impersonate-user" method="POST" requireSession>
  ```ts
  type impersonateUser = {
      /**
       * The user id which you want to impersonate. 
       */
      userId: string = "user-id"
  }
  ```
</APIMethod>

### Stop Impersonating User

To stop impersonating a user and continue with the admin account, you can use `stopImpersonating`

<APIMethod path="/admin/stop-impersonating" method="POST" noResult requireSession>
  ```ts
  type stopImpersonating = {
  }
  ```
</APIMethod>

### Remove User

Hard deletes a user from the database.

<APIMethod path="/admin/remove-user" method="POST" requireSession resultVariable="deletedUser">
  ```ts
  type removeUser = {
      /**
       * The user id which you want to remove. 
       */
      userId: string = "user-id"
  }
  ```
</APIMethod>

## Access Control

The admin plugin offers a highly flexible access control system, allowing you to manage user permissions based on their role. You can define custom permission sets to fit your needs.

### Roles

By default, there are two roles:

`admin`: Users with the admin role have full control over other users.

`user`: Users with the user role have no control over other users.

<Callout>
  A user can have multiple roles. Multiple roles are stored as string separated by comma (",").
</Callout>

### Permissions

By default, there are two resources with up to six permissions.

**user**:
`create` `list` `set-role` `ban` `impersonate` `delete` `set-password`

**session**:
`list` `revoke` `delete`

Users with the admin role have full control over all the resources and actions. Users with the user role have no control over any of those actions.

### Custom Permissions

The plugin provides an easy way to define your own set of permissions for each role.

<Steps>
  <Step>
    #### Create Access Control

    You first need to create an access controller by calling the `createAccessControl` function and passing the statement object. The statement object should have the resource name as the key and the array of actions as the value.

    ```ts title="permissions.ts"
    import { createAccessControl } from "better-auth/plugins/access";

    /**
     * make sure to use `as const` so typescript can infer the type correctly
     */
    const statement = { // [!code highlight]
        project: ["create", "share", "update", "delete"], // [!code highlight]
    } as const; // [!code highlight]

    const ac = createAccessControl(statement); // [!code highlight]
    ```
  </Step>

  <Step>
    #### Create Roles

    Once you have created the access controller you can create roles with the permissions you have defined.

    ```ts title="permissions.ts"
    import { createAccessControl } from "better-auth/plugins/access";

    export const statement = {
        project: ["create", "share", "update", "delete"], // <-- Permissions available for created roles
    } as const;

    const ac = createAccessControl(statement);

    export const user = ac.newRole({ // [!code highlight]
        project: ["create"], // [!code highlight]
    }); // [!code highlight]

    export const admin = ac.newRole({ // [!code highlight]
        project: ["create", "update"], // [!code highlight]
    }); // [!code highlight]

    export const myCustomRole = ac.newRole({ // [!code highlight]
        project: ["create", "update", "delete"], // [!code highlight]
        user: ["ban"], // [!code highlight]
    }); // [!code highlight]
    ```

    When you create custom roles for existing roles, the predefined permissions for those roles will be overridden. To add the existing permissions to the custom role, you need to import `defaultStatements` and merge it with your new statement, plus merge the roles' permissions set with the default roles.

    ```ts title="permissions.ts"
    import { createAccessControl } from "better-auth/plugins/access";
    import { defaultStatements, adminAc } from "better-auth/plugins/admin/access";

    const statement = {
        ...defaultStatements, // [!code highlight]
        project: ["create", "share", "update", "delete"],
    } as const;

    const ac = createAccessControl(statement);

    const admin = ac.newRole({
        project: ["create", "update"],
        ...adminAc.statements, // [!code highlight]
    });
    ```
  </Step>

  <Step>
    #### Pass Roles to the Plugin

    Once you have created the roles you can pass them to the admin plugin both on the client and the server.

    ```ts title="auth.ts"
    import { betterAuth } from "better-auth"
    import { admin as adminPlugin } from "better-auth/plugins"
    import { ac, admin, user } from "@/auth/permissions"

    export const auth = betterAuth({
        plugins: [
            adminPlugin({
                ac,
                roles: {
                    admin,
                    user,
                    myCustomRole
                }
            }),
        ],
    });
    ```

    You also need to pass the access controller and the roles to the client plugin.

    ```ts title="auth-client.ts"
    import { createAuthClient } from "better-auth/client"
    import { adminClient } from "better-auth/client/plugins"
    import { ac, admin, user, myCustomRole } from "@/auth/permissions"

    export const client = createAuthClient({
        plugins: [
            adminClient({
                ac,
                roles: {
                    admin,
                    user,
                    myCustomRole
                }
            })
        ]
    })
    ```
  </Step>
</Steps>

### Access Control Usage

**Has Permission**:

To check a user's permissions, you can use the `hasPermission` function provided by the client.

<APIMethod path="/admin/has-permission" method="POST">
  ```ts
  type userHasPermission = {
      /**
       * The user id which you want to check the permissions for. 
       */
      userId?: string = "user-id"
      /**
       * Check role permissions.
       * @serverOnly
       */
      role?: string = "admin"
      /**
       * Optionally check if a single permission is granted. Must use this, or permissions. 
       */
      permission?: Record<string, string[]> = { "project": ["create", "update"] } /* Must use this, or permissions */,
      /**
       * Optionally check if multiple permissions are granted. Must use this, or permission. 
       */
      permissions?: Record<string, string[]>
  }
  ```
</APIMethod>

Example usage:

```ts title="auth-client.ts"
const canCreateProject = await authClient.admin.hasPermission({
  permissions: {
    project: ["create"],
  },
});

// You can also check multiple resource permissions at the same time
const canCreateProjectAndCreateSale = await authClient.admin.hasPermission({
  permissions: {
    project: ["create"],
    sale: ["create"]
  },
});
```

If you want to check a user's permissions server-side, you can use the `userHasPermission` action provided by the `api` to check the user's permissions.

```ts title="api.ts"
import { auth } from "@/auth";

await auth.api.userHasPermission({
  body: {
    userId: 'id', //the user id
    permissions: {
      project: ["create"], // This must match the structure in your access control
    },
  },
});

// You can also just pass the role directly
await auth.api.userHasPermission({
  body: {
   role: "admin",
    permissions: {
      project: ["create"], // This must match the structure in your access control
    },
  },
});

// You can also check multiple resource permissions at the same time
await auth.api.userHasPermission({
  body: {
   role: "admin",
    permissions: {
      project: ["create"], // This must match the structure in your access control
      sale: ["create"]
    },
  },
});
```

**Check Role Permission**:

Use the `checkRolePermission` function on the client side to verify whether a given **role** has a specific **permission**. This is helpful after defining roles and their permissions, as it allows you to perform permission checks without needing to contact the server.

Note that this function does **not** check the permissions of the currently logged-in user directly. Instead, it checks what permissions are assigned to a specified role. The function is synchronous, so you don't need to use `await` when calling it.

```ts title="auth-client.ts"
const canCreateProject = authClient.admin.checkRolePermission({
  permissions: {
    user: ["delete"],
  },
  role: "admin",
});

// You can also check multiple resource permissions at the same time
const canDeleteUserAndRevokeSession = authClient.admin.checkRolePermission({
  permissions: {
    user: ["delete"],
    session: ["revoke"]
  },
  role: "admin",
});
```

## Schema

This plugin adds the following fields to the `user` table:

<DatabaseTable
  fields={[
  {
    name: "role",
    type: "string",
    description:
      "The user's role. Defaults to `user`. Admins will have the `admin` role.",
    isOptional: true,
  },
  {
    name: "banned",
    type: "boolean",
    description: "Indicates whether the user is banned.",
    isOptional: true,
  },
  {
    name: "banReason",
    type: "string",
    description: "The reason for the user's ban.",
    isOptional: true,
  },
  {
    name: "banExpires",
    type: "date",
    description: "The date when the user's ban will expire.",
    isOptional: true,
  },
]}
/>

And adds one field in the `session` table:

<DatabaseTable
  fields={[
  {
    name: "impersonatedBy",
    type: "string",
    description: "The ID of the admin that is impersonating this session.",
    isOptional: true,
  },
]}
/>

## Options

### Default Role

The default role for a user. Defaults to `user`.

```ts title="auth.ts"
admin({
  defaultRole: "regular",
});
```

### Admin Roles

The roles that are considered admin roles. Defaults to `["admin"]`.

```ts title="auth.ts"
admin({
  adminRoles: ["admin", "superadmin"],
});
```

<Callout type="warning">
  Any role that isn't in the `adminRoles` list, even if they have the permission,
  will not be considered an admin.
</Callout>

### Admin userIds

You can pass an array of userIds that should be considered as admin. Default to `[]`

```ts title="auth.ts"
admin({
    adminUserIds: ["user_id_1", "user_id_2"]
})
```

If a user is in the `adminUserIds` list, they will be able to perform any admin operation.

### impersonationSessionDuration

The duration of the impersonation session in seconds. Defaults to 1 hour.

```ts title="auth.ts"
admin({
  impersonationSessionDuration: 60 * 60 * 24, // 1 day
});
```

### Default Ban Reason

The default ban reason for a user created by the admin. Defaults to `No reason`.

```ts title="auth.ts"
admin({
  defaultBanReason: "Spamming",
});
```

### Default Ban Expires In

The default ban expires in for a user created by the admin in seconds. Defaults to `undefined` (meaning the ban never expires).

```ts title="auth.ts"
admin({
  defaultBanExpiresIn: 60 * 60 * 24, // 1 day
});
```

### bannedUserMessage

The message to show when a banned user tries to sign in. Defaults to "You have been banned from this application. Please contact support if you believe this is an error."

```ts title="auth.ts"
admin({
  bannedUserMessage: "Custom banned user message",
});
```

