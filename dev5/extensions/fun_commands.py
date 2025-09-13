def setup(command_processor):
    """Setup function to register commands with the CommandProcessor."""

    def fitb(args, sender, channel):
        """Command: !fitb - Returns a fun message."""
        return "Fire in the Bowl!! 🔥"

    def poof(args, sender, channel):
        """Command: !poof - Clears user message history (placeholder)."""
        return f"Poof! {sender}'s message history has been cleared (just kidding, not implemented yet)! 💨"

    def roll(args, sender, channel):
        """Command: !roll - Rolls virtual dice with D&D-style notation (e.g., 2d20, 3d6+5, advantage 2d20)."""
        import random

        # Helper function to parse dice string (handles + and - modifiers)
        def parse_dice(dice_str):
            """Parses dice string into components (dice_count, sides, modifier)."""
            dice_str = dice_str.replace(" ", "").lower()

            # Check for modifier (+ or -)
            if '+' in dice_str or '-' in dice_str:
                # Split into dice and modifier
                if '+' in dice_str:
                    parts = dice_str.split('+')
                    dice_part = parts[0]
                    modifier_str = parts[1]
                else:
                    parts = dice_str.split('-')
                    dice_part = parts[0]
                    modifier_str = parts[1]

                # Parse dice part
                try:
                    dice_count, sides = dice_part.split('d')
                    dice_count = int(dice_count)
                    sides = int(sides)
                except (ValueError, IndexError):
                    return None, None, None

                # Parse modifier
                try:
                    modifier = int(modifier_str)
                except ValueError:
                    return None, None, None
                return dice_count, sides, modifier

            else:
                # No modifier
                try:
                    dice_count, sides = dice_str.split('d')
                    dice_count = int(dice_count)
                    sides = int(sides)
                except (ValueError, IndexError):
                    return None, None, None
                return dice_count, sides, 0

        # Split input into tokens
        tokens = args.strip().lower().split()

        # Handle empty input
        if not tokens:
            return f"{sender} rolled a {random.randint(1, 6)} on a 6-sided die! 🎲"

        # Check for advantage/disadvantage
        is_advantage = tokens[0] == "advantage"
        is_disadvantage = tokens[0] == "disadvantage"

        # Handle standard rolls (no advantage/disadvantage)
        if not is_advantage and not is_disadvantage:
            dice_str = tokens[0]
            dice_count, sides, modifier = parse_dice(dice_str)

            if dice_count is None or sides is None or modifier is None:
                return (
                    f"Invalid dice notation. Example: 2d20, 3d6+5. "
                    f"You typed: {dice_str}"
                )

            # Generate dice rolls
            rolls = [random.randint(1, sides) for _ in range(dice_count)]
            total = sum(rolls) + modifier

            # Format results
            roll_breakdown = "  Result: " + "+".join(str(d) for d in rolls) + " = " + str(total)
            return (
                f"{sender} rolled a {dice_count}d{sides}...:\n"
                f"{roll_breakdown}\n"
                f"{sender} rolled a {total} total!"
            )

        # Handle advantage/disadvantage rolls
        else:
            dice_str = tokens[1]
            dice_count, sides, modifier = parse_dice(dice_str)

            if dice_count is None or sides is None or modifier is None:
                return (
                    f"Invalid dice notation. Example: advantage 2d20, disadvantage 4d6. "
                    f"You typed: {dice_str}"
                )

            # Generate two separate rolls
            roll1 = [random.randint(1, sides) for _ in range(dice_count)]
            roll2 = [random.randint(1, sides) for _ in range(dice_count)]

            # Calculate totals
            total1 = sum(roll1) + modifier
            total2 = sum(roll2) + modifier

            # Format individual roll breakdowns
            def format_roll(roll, total):
                return f"    #{roll}: ({'+'.join(str(d) for d in roll)}) + {modifier} = {total}"

            # Determine winner
            if is_advantage:
                winner = "highest"
                winner_roll = max(total1, total2)
                winner_index = 1 if total1 > total2 else 2
            else:
                winner = "lowest"
                winner_roll = min(total1, total2)
                winner_index = 1 if total1 < total2 else 2

            # Build output
            output = (
                f"{sender} rolls a {dice_count}d{sides} with {('advantage' if is_advantage else 'disadvantage')}! "
                f"Rolls are...:\n"
                f"{format_roll(roll1, total1)}\n"
                f"{format_roll(roll2, total2)}\n"
                f"{winner} roll #{winner_index} is {winner} with {winner_roll}!"
            )

            return output

    # Register commands
    command_processor.register_command('fitb', fitb)
    command_processor.register_command('poof', poof)
    command_processor.register_command('roll', roll)
