// Type definitions for Minecraft Bedrock Edition script APIs
// Project: https://docs.microsoft.com/minecraft/creator/
// Definitions by: Jake Shirley <https://github.com/JakeShirley>
//                 Mike Ammerlaan <https://github.com/mammerla>

/* *****************************************************************************
   Copyright (c) Microsoft Corporation.
   ***************************************************************************** */
/**
 * @packageDocumentation
 * The `@minecraft/server-ui` module contains types for
 * expressing simple dialog-based user experiences.
 *
 *   * {@link ActionFormData} contain a list of buttons with
 * captions and images that can be used for presenting a set of
 * options to a player.
 *   * {@link MessageFormData} are simple two-button message
 * experiences that are functional for Yes/No or OK/Cancel
 * questions.
 *   * {@link ModalFormData} allow for a more flexible
 * "questionnaire-style" list of controls that can be used to
 * take input.
 * @example createActionForm.js
 * ```typescript
 * const form = new ActionFormData()
 *   .title("Months")
 *   .body("Choose your favorite month!")
 *   .button("January")
 *   .button("February")
 *   .button("March")
 *   .button("April")
 *   .button("May");
 *
 * form.show(players[0]).then((response) => {
 *   if (response.selection === 3) {
 *     dimension.runCommand("say I like April too!");
 *   }
 * });
 * ```
 *
 * Manifest Details
 * ```json
 * {
 *   "module_name": "@minecraft/server-ui",
 *   "version": "1.3.0"
 * }
 * ```
 *
 */
import * as minecraftcommon from '@minecraft/common';
import * as minecraftserver from '@minecraft/server';
export enum FormCancelationReason {
    UserBusy = 'UserBusy',
    UserClosed = 'UserClosed',
}

export enum FormRejectReason {
    MalformedResponse = 'MalformedResponse',
    PlayerQuit = 'PlayerQuit',
    ServerShutdown = 'ServerShutdown',
}

/**
 * Builds a simple player form with buttons that let the player
 * take action.
 * @example actionFormAskFavoriteMonth.ts
 * ```typescript
 * import { Player } from '@minecraft/server';
 * import { ActionFormData, ActionFormResponse } from '@minecraft/server-ui';
 *
 * function askFavoriteMonth(player: Player) {
 *     const form = new ActionFormData()
 *         .title('Months')
 *         .body('Choose your favorite month!')
 *         .button('January')
 *         .button('February')
 *         .button('March')
 *         .button('April')
 *         .button('May');
 *
 *     form.show(player).then((response: ActionFormResponse) => {
 *         if (response.selection === 3) {
 *             player.sendMessage('I like April too!');
 *         } else {
 *             player.sendMessage('Nah, April is the best.');
 *         }
 *     });
 * }
 * ```
 */
export class ActionFormData {
    /**
     * @remarks
     * Method that sets the body text for the modal form.
     *
     */
    body(bodyText: minecraftserver.RawMessage | string): ActionFormData;
    /**
     * @remarks
     * Adds a button to this form with an icon from a resource
     * pack.
     *
     */
    button(text: minecraftserver.RawMessage | string, iconPath?: string): ActionFormData;
    /**
     * @remarks
     * Creates and shows this modal popup form. Returns
     * asynchronously when the player confirms or cancels the
     * dialog.
     *
     * This function can't be called in read-only mode.
     *
     * @param player
     * Player to show this dialog to.
     * @throws This function can throw errors.
     */
    show(player: minecraftserver.Player): Promise<ActionFormResponse>;
    /**
     * @remarks
     * This builder method sets the title for the modal dialog.
     *
     */
    title(titleText: minecraftserver.RawMessage | string): ActionFormData;
}

/**
 * Returns data about the player results from a modal action
 * form.
 * @example actionFormAskFavoriteMonth.ts
 * ```typescript
 * import { Player } from '@minecraft/server';
 * import { ActionFormData, ActionFormResponse } from '@minecraft/server-ui';
 *
 * function askFavoriteMonth(player: Player) {
 *     const form = new ActionFormData()
 *         .title('Months')
 *         .body('Choose your favorite month!')
 *         .button('January')
 *         .button('February')
 *         .button('March')
 *         .button('April')
 *         .button('May');
 *
 *     form.show(player).then((response: ActionFormResponse) => {
 *         if (response.selection === 3) {
 *             player.sendMessage('I like April too!');
 *         } else {
 *             player.sendMessage('Nah, April is the best.');
 *         }
 *     });
 * }
 * ```
 */
// @ts-ignore Class inheritance allowed for native defined classes
export class ActionFormResponse extends FormResponse {
    private constructor();
    /**
     * @remarks
     * Returns the index of the button that was pushed.
     *
     */
    readonly selection?: number;
}

/**
 * Base type for a form response.
 */
export class FormResponse {
    private constructor();
    /**
     * @remarks
     * Contains additional details as to why a form was canceled.
     *
     */
    readonly cancelationReason?: FormCancelationReason;
    /**
     * @remarks
     * If true, the form was canceled by the player (e.g., they
     * selected the pop-up X close button).
     *
     */
    readonly canceled: boolean;
}

/**
 * Builds a simple two-button modal dialog.
 * @example messageFormSimple.ts
 * ```typescript
 * import { Player } from '@minecraft/server';
 * import { MessageFormResponse, MessageFormData } from '@minecraft/server-ui';
 *
 * function showMessage(player: Player) {
 *     const messageForm = new MessageFormData()
 *         .title({ translate: 'permissions.removeplayer' }) // "Remove player"
 *         .body({ translate: 'accessibility.list.or.two', with: ['Player 1', 'Player 2'] }) // "Player 1 or Player 2"
 *         .button1('Player 1')
 *         .button2('Player 2');
 *
 *     messageForm
 *         .show(player)
 *         .then((formData: MessageFormResponse) => {
 *             // player canceled the form, or another dialog was up and open.
 *             if (formData.canceled || formData.selection === undefined) {
 *                 return;
 *             }
 *
 *             player.sendMessage(`You selected ${formData.selection === 0 ? 'Player 1' : 'Player 2'}`);
 *         })
 *         .catch((error: Error) => {
 *             player.sendMessage('Failed to show form: ' + error);
 *         });
 * }
 * ```
 */
export class MessageFormData {
    /**
     * @remarks
     * Method that sets the body text for the modal form.
     *
     */
    body(bodyText: minecraftserver.RawMessage | string): MessageFormData;
    /**
     * @remarks
     * Method that sets the text for the first button of the
     * dialog.
     *
     */
    button1(text: minecraftserver.RawMessage | string): MessageFormData;
    /**
     * @remarks
     * This method sets the text for the second button on the
     * dialog.
     *
     */
    button2(text: minecraftserver.RawMessage | string): MessageFormData;
    /**
     * @remarks
     * Creates and shows this modal popup form. Returns
     * asynchronously when the player confirms or cancels the
     * dialog.
     *
     * This function can't be called in read-only mode.
     *
     * @param player
     * Player to show this dialog to.
     * @throws This function can throw errors.
     */
    show(player: minecraftserver.Player): Promise<MessageFormResponse>;
    /**
     * @remarks
     * This builder method sets the title for the modal dialog.
     *
     */
    title(titleText: minecraftserver.RawMessage | string): MessageFormData;
}

/**
 * Returns data about the player results from a modal message
 * form.
 * @example messageFormSimple.ts
 * ```typescript
 * import { Player } from '@minecraft/server';
 * import { MessageFormResponse, MessageFormData } from '@minecraft/server-ui';
 *
 * function showMessage(player: Player) {
 *     const messageForm = new MessageFormData()
 *         .title({ translate: 'permissions.removeplayer' }) // "Remove player"
 *         .body({ translate: 'accessibility.list.or.two', with: ['Player 1', 'Player 2'] }) // "Player 1 or Player 2"
 *         .button1('Player 1')
 *         .button2('Player 2');
 *
 *     messageForm
 *         .show(player)
 *         .then((formData: MessageFormResponse) => {
 *             // player canceled the form, or another dialog was up and open.
 *             if (formData.canceled || formData.selection === undefined) {
 *                 return;
 *             }
 *
 *             player.sendMessage(`You selected ${formData.selection === 0 ? 'Player 1' : 'Player 2'}`);
 *         })
 *         .catch((error: Error) => {
 *             player.sendMessage('Failed to show form: ' + error);
 *         });
 * }
 * ```
 */
// @ts-ignore Class inheritance allowed for native defined classes
export class MessageFormResponse extends FormResponse {
    private constructor();
    /**
     * @remarks
     * Returns the index of the button that was pushed.
     *
     */
    readonly selection?: number;
}

/**
 * Used to create a fully customizable pop-up form for a
 * player.
 * @example modalFormSimple.ts
 * ```typescript
 * import { Player } from '@minecraft/server';
 * import { ModalFormData } from '@minecraft/server-ui';
 *
 * function showExampleModal(player: Player) {
 *     const modalForm = new ModalFormData().title('Example Modal Controls for §o§7ModalFormData§r');
 *
 *     modalForm.toggle('Toggle w/o default');
 *     modalForm.toggle('Toggle w/ default', true);
 *
 *     modalForm.slider('Slider w/o default', 0, 50, 5);
 *     modalForm.slider('Slider w/ default', 0, 50, 5, 30);
 *
 *     modalForm.dropdown('Dropdown w/o default', ['option 1', 'option 2', 'option 3']);
 *     modalForm.dropdown('Dropdown w/ default', ['option 1', 'option 2', 'option 3'], 2);
 *
 *     modalForm.textField('Input w/o default', 'type text here');
 *     modalForm.textField('Input w/ default', 'type text here', 'this is default');
 *
 *     modalForm
 *         .show(player)
 *         .then(formData => {
 *             player.sendMessage(`Modal form results: ${JSON.stringify(formData.formValues, undefined, 2)}`);
 *         })
 *         .catch((error: Error) => {
 *             player.sendMessage('Failed to show form: ' + error);
 *             return -1;
 *         });
 * }
 * ```
 */
export class ModalFormData {
    /**
     * @remarks
     * Adds a dropdown with choices to the form.
     *
     */
    dropdown(
        label: minecraftserver.RawMessage | string,
        options: (minecraftserver.RawMessage | string)[],
        defaultValueIndex?: number,
    ): ModalFormData;
    /**
     * @remarks
     * Creates and shows this modal popup form. Returns
     * asynchronously when the player confirms or cancels the
     * dialog.
     *
     * This function can't be called in read-only mode.
     *
     * @param player
     * Player to show this dialog to.
     * @throws This function can throw errors.
     */
    show(player: minecraftserver.Player): Promise<ModalFormResponse>;
    /**
     * @remarks
     * Adds a numeric slider to the form.
     *
     */
    slider(
        label: minecraftserver.RawMessage | string,
        minimumValue: number,
        maximumValue: number,
        valueStep: number,
        defaultValue?: number,
    ): ModalFormData;
    submitButton(submitButtonText: minecraftserver.RawMessage | string): ModalFormData;
    /**
     * @remarks
     * Adds a textbox to the form.
     *
     */
    textField(
        label: minecraftserver.RawMessage | string,
        placeholderText: minecraftserver.RawMessage | string,
        defaultValue?: minecraftserver.RawMessage | string,
    ): ModalFormData;
    /**
     * @remarks
     * This builder method sets the title for the modal dialog.
     *
     */
    title(titleText: minecraftserver.RawMessage | string): ModalFormData;
    /**
     * @remarks
     * Adds a toggle checkbox button to the form.
     *
     */
    toggle(label: minecraftserver.RawMessage | string, defaultValue?: boolean): ModalFormData;
}

/**
 * Returns data about player responses to a modal form.
 * @example modalFormSimple.ts
 * ```typescript
 * import { Player } from '@minecraft/server';
 * import { ModalFormData } from '@minecraft/server-ui';
 *
 * function showExampleModal(player: Player) {
 *     const modalForm = new ModalFormData().title('Example Modal Controls for §o§7ModalFormData§r');
 *
 *     modalForm.toggle('Toggle w/o default');
 *     modalForm.toggle('Toggle w/ default', true);
 *
 *     modalForm.slider('Slider w/o default', 0, 50, 5);
 *     modalForm.slider('Slider w/ default', 0, 50, 5, 30);
 *
 *     modalForm.dropdown('Dropdown w/o default', ['option 1', 'option 2', 'option 3']);
 *     modalForm.dropdown('Dropdown w/ default', ['option 1', 'option 2', 'option 3'], 2);
 *
 *     modalForm.textField('Input w/o default', 'type text here');
 *     modalForm.textField('Input w/ default', 'type text here', 'this is default');
 *
 *     modalForm
 *         .show(player)
 *         .then(formData => {
 *             player.sendMessage(`Modal form results: ${JSON.stringify(formData.formValues, undefined, 2)}`);
 *         })
 *         .catch((error: Error) => {
 *             player.sendMessage('Failed to show form: ' + error);
 *             return -1;
 *         });
 * }
 * ```
 */
// @ts-ignore Class inheritance allowed for native defined classes
export class ModalFormResponse extends FormResponse {
    private constructor();
    /**
     * @remarks
     * An ordered set of values based on the order of controls
     * specified by ModalFormData.
     *
     */
    readonly formValues?: (boolean | number | string)[];
}

export class UIManager {
    private constructor();
    /**
     * @remarks
     * This function can't be called in read-only mode.
     *
     * @throws This function can throw errors.
     */
    closeAllForms(player: minecraftserver.Player): void;
}

// @ts-ignore Class inheritance allowed for native defined classes
export class FormRejectError extends Error {
    private constructor();
    reason: FormRejectReason;
}

export const uiManager: UIManager;
