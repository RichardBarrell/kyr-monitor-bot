import { Message, TextChannel, NewsChannel, ThreadChannel, DMChannel } from "discord.js";

export type SendableChannel = TextChannel | NewsChannel | ThreadChannel | DMChannel;
export type SendableMessage = Message<true> & { channel: SendableChannel };

export type DiscordId = string;
export type UserName = string;

/**
 * Replaces properties in A with properties from B.
 * Like {...A, ...B}
 */
export type ReplaceProperties<A, B> = Omit<A, keyof B> & B;
