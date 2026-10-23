from aiogram import Router, F
from aiogram.types import Message, CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
import logging
from db import db
from config import MAIN_MENU_TEXT, ABOUT_TEXT

logger = logging.getLogger(__name__)

class ResourceStates(StatesGroup):
    waiting_for_scheme = State()
    waiting_for_branch = State()
    waiting_for_semester = State()
    waiting_for_subject = State()
    waiting_for_resource_type = State()
    waiting_for_module = State()

class SubmissionStates(StatesGroup):
    waiting_for_type = State()
    waiting_for_scheme = State()
    waiting_for_branch = State()
    waiting_for_semester = State()
    waiting_for_subject = State()
    waiting_for_module = State()
    waiting_for_custom_module = State()
    waiting_for_file = State()
    waiting_for_link = State()
    waiting_for_new_scheme = State()
    waiting_for_new_branch = State()
    waiting_for_new_semester = State()
    waiting_for_new_subject = State()

router = Router()

def create_main_menu():
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="📚 Get Resources", callback_data="get_resources")],
        [InlineKeyboardButton(text="📤 Submit Resources", callback_data="submit_resources")],
        [InlineKeyboardButton(text="ℹ️ About", callback_data="about")],
        [InlineKeyboardButton(text="🔑 Admin Panel", callback_data="admin_panel")]
    ])
    return keyboard

def create_back_to_menu():
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🏠 Back to Menu", callback_data="back_to_menu")]
    ])

@router.message(Command("start"))
async def start_handler(message: Message, state: FSMContext):
    logger.info(f"User {message.from_user.id} ({message.from_user.username}) started the bot")
    await state.clear()
    await message.answer(MAIN_MENU_TEXT, reply_markup=create_main_menu())

@router.callback_query(F.data == "back_to_menu")
async def back_to_menu(callback: CallbackQuery, state: FSMContext):
    logger.info(f"User {callback.from_user.id} returned to main menu")
    await state.clear()
    await callback.message.edit_text(MAIN_MENU_TEXT, reply_markup=create_main_menu())

@router.callback_query(F.data == "about")
async def about_handler(callback: CallbackQuery):
    logger.info(f"User {callback.from_user.id} viewed about section")
    await callback.message.edit_text(ABOUT_TEXT, reply_markup=create_back_to_menu())

@router.callback_query(F.data == "get_resources")
async def get_resources_handler(callback: CallbackQuery, state: FSMContext):
    logger.info(f"User {callback.from_user.id} started resource retrieval")
    await state.set_state(ResourceStates.waiting_for_scheme)
    
    schemes = await db.get_schemes()
    if not schemes:
        await callback.message.edit_text(
            "❌ No schemes available yet. Please check back later or submit new resources.",
            reply_markup=create_back_to_menu()
        )
        return
    
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=scheme, callback_data=f"scheme_{scheme}")] for scheme in schemes
    ] + [[InlineKeyboardButton(text="🏠 Back to Menu", callback_data="back_to_menu")]])
    
    await callback.message.edit_text("📋 Select Scheme:", reply_markup=keyboard)

@router.callback_query(F.data.startswith("scheme_"))
async def scheme_selected(callback: CallbackQuery, state: FSMContext):
    scheme = callback.data.split("scheme_")[1]
    logger.info(f"User {callback.from_user.id} selected scheme: {scheme}")
    await state.update_data(scheme=scheme)
    await state.set_state(ResourceStates.waiting_for_branch)
    
    branches = await db.get_branches(scheme)
    if not branches:
        await callback.message.edit_text(
            f"❌ No branches available for scheme {scheme}.",
            reply_markup=create_back_to_menu()
        )
        return
    
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=branch, callback_data=f"branch_{branch}")] for branch in branches
    ] + [[InlineKeyboardButton(text="🔙 Back", callback_data="get_resources")],
         [InlineKeyboardButton(text="🏠 Menu", callback_data="back_to_menu")]])
    
    await callback.message.edit_text(f"🏢 Select Branch for {scheme}:", reply_markup=keyboard)

@router.callback_query(F.data.startswith("branch_"))
async def branch_selected(callback: CallbackQuery, state: FSMContext):
    branch = callback.data.split("branch_")[1]
    logger.info(f"User {callback.from_user.id} selected branch: {branch}")
    data = await state.get_data()
    await state.update_data(branch=branch)
    await state.set_state(ResourceStates.waiting_for_semester)
    
    semesters = await db.get_semesters(data["scheme"], branch)
    if not semesters:
        await callback.message.edit_text(
            f"❌ No semesters available for {data['scheme']}/{branch}.",
            reply_markup=create_back_to_menu()
        )
        return
    
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=f"Semester {sem}", callback_data=f"semester_{sem}")] for sem in semesters
    ] + [[InlineKeyboardButton(text="🔙 Back", callback_data=f"scheme_{data['scheme']}")],
         [InlineKeyboardButton(text="🏠 Menu", callback_data="back_to_menu")]])
    
    await callback.message.edit_text(f"📅 Select Semester for {data['scheme']}/{branch}:", reply_markup=keyboard)

@router.callback_query(F.data.startswith("semester_"))
async def semester_selected(callback: CallbackQuery, state: FSMContext):
    semester = callback.data.split("semester_")[1]
    logger.info(f"User {callback.from_user.id} selected semester: {semester}")
    data = await state.get_data()
    await state.update_data(semester=semester)
    await state.set_state(ResourceStates.waiting_for_subject)
    
    subjects = await db.get_subjects(data["scheme"], data["branch"], semester)
    if not subjects:
        await callback.message.edit_text(
            f"❌ No subjects available for {data['scheme']}/{data['branch']}/Sem {semester}.",
            reply_markup=create_back_to_menu()
        )
        return
    
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=subject, callback_data=f"subject_{subject}")] for subject in subjects
    ] + [[InlineKeyboardButton(text="🔙 Back", callback_data=f"branch_{data['branch']}")],
         [InlineKeyboardButton(text="🏠 Menu", callback_data="back_to_menu")]])
    
    await callback.message.edit_text(f"📚 Select Subject for Semester {semester}:", reply_markup=keyboard)

@router.callback_query(F.data.startswith("subject_"))
async def subject_selected(callback: CallbackQuery, state: FSMContext):
    subject = callback.data.split("subject_")[1]
    logger.info(f"User {callback.from_user.id} selected subject: {subject}")
    data = await state.get_data()
    await state.update_data(subject=subject)
    await state.set_state(ResourceStates.waiting_for_resource_type)
    
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="📑 Notes", callback_data="resource_note")],
        [InlineKeyboardButton(text="🎥 Videos", callback_data="resource_video")],
        [InlineKeyboardButton(text="🔙 Back", callback_data=f"semester_{data['semester']}")],
        [InlineKeyboardButton(text="🏠 Menu", callback_data="back_to_menu")]
    ])
    
    await callback.message.edit_text(f"📖 Select Resource Type for {subject}:", reply_markup=keyboard)

@router.callback_query(F.data.startswith("resource_"))
async def resource_type_selected(callback: CallbackQuery, state: FSMContext):
    resource_type = callback.data.split("resource_")[1]
    logger.info(f"User {callback.from_user.id} selected resource type: {resource_type}")
    data = await state.get_data()
    await state.update_data(resource_type=resource_type)
    # Ask for module selection for filtering
    modules = await db.get_modules(data["scheme"], data["branch"], data["semester"], data["subject"])
    if not modules:
        # No modules set yet; proceed with all
        logger.info("No modules found; proceeding with all modules")
        await module_selected(callback, state, module_value="all", internal_call=True)
        return
    keyboard = InlineKeyboardMarkup(inline_keyboard=
        [[InlineKeyboardButton(text="📚 All Modules", callback_data="module_all")]] +
        [[InlineKeyboardButton(text=f"Module: {m}", callback_data=f"module_{m}")] for m in modules] +
        [[InlineKeyboardButton(text="🔙 Back", callback_data=f"subject_{data['subject']}")],
         [InlineKeyboardButton(text="🏠 Menu", callback_data="back_to_menu")]]
    )
    await state.set_state(ResourceStates.waiting_for_module)
    await callback.message.edit_text(
        f"🧩 Select Module for {data['subject']} ({resource_type}s):",
        reply_markup=keyboard
    )

@router.callback_query(F.data.startswith("module_"))
async def module_selected(callback: CallbackQuery, state: FSMContext, module_value: str | None = None, internal_call: bool = False):
    # When called via internal_call, we already have callback; module_value provided
    if not internal_call:
        module_value = callback.data.split("module_")[1]
    data = await state.get_data()
    resource_type = data.get("resource_type", "note")
    module = None if module_value == "all" else module_value
    logger.info(f"User {callback.from_user.id} selected module: {module_value}")
    resources = await db.get_resources(
        data["scheme"], data["branch"], data["semester"], data["subject"], resource_type, module
    )
    if not resources:
        await callback.message.edit_text(
            f"❌ No {resource_type}s available for {data['subject']} (module: {module or 'All'}).\n\n"
            "You can submit new resources using the Submit Resources option!",
            reply_markup=create_back_to_menu()
        )
        await state.clear()
        return
    # Show resources similar to previous logic, but add module label where relevant
    if resource_type == "note":
        header_text = f"📚 **{data['subject']} Notes** ({len(resources)} files)\n"
        header_text += f"📋 {data['scheme']} → {data['branch']} → Semester {data['semester']}\n"
        if module:
            header_text += f"🧩 Module: {module}\n"
        header_text += "\n💾 **Downloading notes to your device...**\n"
        header_text += "📱 Files will appear in your Telegram Downloads folder"
        await callback.message.edit_text(
            header_text,
            reply_markup=create_back_to_menu(),
            parse_mode="Markdown"
        )
        for i, resource in enumerate(resources, 1):
            try:
                caption = f"📄 **Note {i} of {len(resources)}** - {data['subject']}\n"
                caption += f"📂 {data['scheme']}/{data['branch']}/Sem {data['semester']}\n"
                if module:
                    caption += f"🧩 Module: {module}\n\n"
                else:
                    caption += "\n"
                caption += "💾 **Tap to download** this file to your device\n"
                caption += "📱 Long press → Save to Downloads"
                await callback.bot.send_document(
                    chat_id=callback.from_user.id,
                    document=resource['data'],
                    caption=caption,
                    parse_mode="Markdown"
                )
            except Exception as e:
                logger.error(f"Failed to send file {resource['data']}: {e}")
                await callback.bot.send_message(
                    chat_id=callback.from_user.id,
                    text=f"❌ **Download Failed** - Note {i}\n\nFile may no longer be available. Please contact admin.",
                    parse_mode="Markdown"
                )
        await callback.bot.send_message(
            chat_id=callback.from_user.id,
            text=f"✅ **Download Complete!**\n\n📁 {len(resources)} note(s) have been sent to your chat.",
            parse_mode="Markdown"
        )
    else:
        response_text = f"🎥 **{data['subject']} Video Resources** ({len(resources)} links)\n"
        response_text += f"📋 {data['scheme']} → {data['branch']} → Semester {data['semester']}\n"
        if module:
            response_text += f"🧩 Module: {module}\n"
        response_text += "\n🔗 **Click any link below to watch the videos:**\n\n"
        for i, resource in enumerate(resources, 1):
            video_url = resource['data']
            if 'youtube.com/watch?v=' in video_url:
                video_id = video_url.split('watch?v=')[1].split('&')[0]
                response_text += f"🎬 **Video {i}**\n"
                response_text += f"▶️ [🔴 Watch on YouTube](https://youtu.be/{video_id})\n"
                response_text += f"📱 [🔗 Direct Link]({video_url})\n\n"
            elif 'youtu.be/' in video_url:
                response_text += f"🎬 **Video {i}**\n"
                response_text += f"▶️ [🔴 Watch on YouTube]({video_url})\n\n"
            else:
                response_text += f"🎬 **Video {i}**\n"
                response_text += f"🔗 [📺 Open Video]({video_url})\n\n"
        response_text += "💡 **Tip:** Tap any link to open the video in YouTube app or browser"
        await callback.message.edit_text(
            response_text,
            reply_markup=create_back_to_menu(),
            parse_mode="Markdown",
            disable_web_page_preview=True
        )
    await state.clear()

@router.callback_query(F.data == "submit_resources")
async def submit_resources_handler(callback: CallbackQuery, state: FSMContext):
    logger.info(f"User {callback.from_user.id} started resource submission")
    await state.set_state(SubmissionStates.waiting_for_type)
    
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="📑 Submit Notes", callback_data="submit_note")],
        [InlineKeyboardButton(text="🎥 Submit Video Link", callback_data="submit_video")],
        [InlineKeyboardButton(text="🏠 Back to Menu", callback_data="back_to_menu")]
    ])
    
    await callback.message.edit_text("📤 What would you like to submit?", reply_markup=keyboard)

@router.callback_query(F.data.startswith("submit_"))
async def submission_type_selected(callback: CallbackQuery, state: FSMContext):
    submission_type = callback.data.split("submit_")[1]
    logger.info(f"User {callback.from_user.id} selected submission type: {submission_type}")
    await state.update_data(submission_type=submission_type)
    await state.set_state(SubmissionStates.waiting_for_scheme)
    
    schemes = await db.get_schemes()
    
    keyboard_buttons = []
    if schemes:
        keyboard_buttons.extend([
            [InlineKeyboardButton(text=scheme, callback_data=f"sub_scheme_{scheme}")] for scheme in schemes
        ])
    
    keyboard_buttons.extend([
        [InlineKeyboardButton(text="➕ Add New Scheme", callback_data="new_scheme")],
        [InlineKeyboardButton(text="🔙 Back", callback_data="submit_resources")],
        [InlineKeyboardButton(text="🏠 Menu", callback_data="back_to_menu")]
    ])
    
    keyboard = InlineKeyboardMarkup(inline_keyboard=keyboard_buttons)
    await callback.message.edit_text("📋 Select or Add Scheme:", reply_markup=keyboard)

@router.callback_query(F.data == "new_scheme")
async def new_scheme_handler(callback: CallbackQuery, state: FSMContext):
    logger.info(f"User {callback.from_user.id} wants to add new scheme")
    await state.set_state(SubmissionStates.waiting_for_new_scheme)
    await callback.message.edit_text(
        "📝 Enter the new scheme name (e.g., 2025, 2026):",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="🔙 Back", callback_data="submit_resources")]
        ])
    )

@router.message(SubmissionStates.waiting_for_new_scheme)
async def process_new_scheme(message: Message, state: FSMContext):
    scheme = message.text.strip()
    logger.info(f"User {message.from_user.id} entered new scheme: {scheme}")
    await state.update_data(scheme=scheme, is_new_scheme=True)
    await state.set_state(SubmissionStates.waiting_for_new_branch)
    await message.answer(
        f"📝 Enter the branch name for scheme {scheme} (e.g., CSE, ECE, ME):",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="🔙 Back", callback_data="submit_resources")]
        ])
    )

@router.message(SubmissionStates.waiting_for_new_branch)
async def process_new_branch(message: Message, state: FSMContext):
    branch = message.text.strip()
    data = await state.get_data()
    logger.info(f"User {message.from_user.id} entered new branch: {branch}")
    await state.update_data(branch=branch, is_new_branch=True)
    await state.set_state(SubmissionStates.waiting_for_new_semester)
    await message.answer(
        f"📝 Enter the semester number for {data['scheme']}/{branch} (1-8):",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="🔙 Back", callback_data="submit_resources")]
        ])
    )

@router.message(SubmissionStates.waiting_for_new_semester)
async def process_new_semester(message: Message, state: FSMContext):
    semester = message.text.strip()
    data = await state.get_data()
    logger.info(f"User {message.from_user.id} entered new semester: {semester}")
    await state.update_data(semester=semester, is_new_semester=True)
    await state.set_state(SubmissionStates.waiting_for_new_subject)
    await message.answer(
        f"📝 Enter the subject name for {data['scheme']}/{data['branch']}/Sem {semester}:",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="🔙 Back", callback_data="submit_resources")]
        ])
    )

@router.message(SubmissionStates.waiting_for_new_subject)
async def process_new_subject(message: Message, state: FSMContext):
    subject = message.text.strip()
    data = await state.get_data()
    logger.info(f"User {message.from_user.id} entered new subject: {subject}")
    await state.update_data(subject=subject, is_new_subject=True)
    
    await db.add_pending_category(
        message.from_user.id,
        data["scheme"],
        data["branch"],
        data["semester"],
        subject
    )
    # Ask for module for submission
    await state.set_state(SubmissionStates.waiting_for_module)
    await message.answer(
        f"🧩 Which module is this for {subject}?",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="Module 1", callback_data="pick_module_Module 1")],
            [InlineKeyboardButton(text="Module 2", callback_data="pick_module_Module 2")],
            [InlineKeyboardButton(text="Module 3", callback_data="pick_module_Module 3")],
            [InlineKeyboardButton(text="Module 4", callback_data="pick_module_Module 4")],
            [InlineKeyboardButton(text="Module 5", callback_data="pick_module_Module 5")],
            [InlineKeyboardButton(text="Other / Custom", callback_data="pick_module_custom")]
        ])
    )

@router.callback_query(F.data.startswith("pick_module_"))
async def submission_pick_module(callback: CallbackQuery, state: FSMContext):
    choice = callback.data.split("pick_module_")[1]
    if choice == "custom":
        await state.set_state(SubmissionStates.waiting_for_custom_module)
        await callback.message.edit_text(
            "✍️ Send the module name (e.g., 'Module A', 'Intro Unit', 'Ch-1'):",
            reply_markup=InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="🔙 Back", callback_data="submit_resources")]])
        )
        return
    await state.update_data(module=choice)
    data = await state.get_data()
    # Now proceed to file or link
    if data.get("submission_type") == "note":
        await state.set_state(SubmissionStates.waiting_for_file)
        await callback.message.edit_text(
            f"📄 Please upload the note file for {data['subject']} (Module: {choice}):",
            reply_markup=InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="🔙 Back", callback_data="submit_resources")]])
        )
    else:
        await state.set_state(SubmissionStates.waiting_for_link)
        await callback.message.edit_text(
            f"🔗 Please send the YouTube link for {data['subject']} (Module: {choice}):",
            reply_markup=InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="🔙 Back", callback_data="submit_resources")]])
        )

@router.message(SubmissionStates.waiting_for_custom_module)
async def submission_custom_module(message: Message, state: FSMContext):
    module_name = message.text.strip()
    await state.update_data(module=module_name)
    data = await state.get_data()
    if data.get("submission_type") == "note":
        await state.set_state(SubmissionStates.waiting_for_file)
        await message.answer(
            f"📄 Please upload the note file for {data['subject']} (Module: {module_name}):",
            reply_markup=InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="🔙 Back", callback_data="submit_resources")]])
        )
    else:
        await state.set_state(SubmissionStates.waiting_for_link)
        await message.answer(
            f"🔗 Please send the YouTube link for {data['subject']} (Module: {module_name}):",
            reply_markup=InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="🔙 Back", callback_data="submit_resources")]])
        )

@router.callback_query(F.data.startswith("sub_scheme_"))
async def submission_scheme_selected(callback: CallbackQuery, state: FSMContext):
    scheme = callback.data.split("sub_scheme_")[1]
    logger.info(f"User {callback.from_user.id} selected existing scheme for submission: {scheme}")
    await state.update_data(scheme=scheme)
    await state.set_state(SubmissionStates.waiting_for_branch)
    
    branches = await db.get_branches(scheme)
    
    keyboard_buttons = []
    if branches:
        keyboard_buttons.extend([
            [InlineKeyboardButton(text=branch, callback_data=f"sub_branch_{branch}")] for branch in branches
        ])
    
    keyboard_buttons.extend([
        [InlineKeyboardButton(text="➕ Add New Branch", callback_data="new_branch")],
        [InlineKeyboardButton(text="🔙 Back", callback_data="submit_resources")],
        [InlineKeyboardButton(text="🏠 Menu", callback_data="back_to_menu")]
    ])
    
    keyboard = InlineKeyboardMarkup(inline_keyboard=keyboard_buttons)
    await callback.message.edit_text(f"🏢 Select or Add Branch for {scheme}:", reply_markup=keyboard)

@router.callback_query(F.data == "new_branch")
async def submission_new_branch(callback: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    await state.set_state(SubmissionStates.waiting_for_new_branch)
    await callback.message.edit_text(
        f"📝 Enter the branch name for scheme {data.get('scheme')} (e.g., CSE, ECE, ME):",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="🔙 Back", callback_data=f"sub_scheme_{data.get('scheme')}")]])
    )

@router.callback_query(F.data.startswith("sub_branch_"))
async def submission_branch_selected(callback: CallbackQuery, state: FSMContext):
    branch = callback.data.split("sub_branch_")[1]
    await state.update_data(branch=branch)
    data = await state.get_data()
    semesters = await db.get_semesters(data["scheme"], branch)
    keyboard_buttons = []
    if semesters:
        keyboard_buttons.extend([[InlineKeyboardButton(text=f"Semester {s}", callback_data=f"sub_semester_{s}")] for s in semesters])
    keyboard_buttons.extend([
        [InlineKeyboardButton(text="➕ Add New Semester", callback_data="new_semester")],
        [InlineKeyboardButton(text="🔙 Back", callback_data=f"sub_scheme_{data['scheme']}")],
        [InlineKeyboardButton(text="🏠 Menu", callback_data="back_to_menu")]
    ])
    await state.set_state(SubmissionStates.waiting_for_semester)
    await callback.message.edit_text(
        f"📅 Select or Add Semester for {data['scheme']}/{branch}:",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=keyboard_buttons)
    )

@router.callback_query(F.data == "new_semester")
async def submission_new_semester(callback: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    await state.set_state(SubmissionStates.waiting_for_new_semester)
    await callback.message.edit_text(
        f"📝 Enter the semester number for {data.get('scheme')}/{data.get('branch')} (1-8):",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="🔙 Back", callback_data=f"sub_branch_{data.get('branch')}")]])
    )

@router.callback_query(F.data.startswith("sub_semester_"))
async def submission_semester_selected(callback: CallbackQuery, state: FSMContext):
    semester = callback.data.split("sub_semester_")[1]
    await state.update_data(semester=semester)
    data = await state.get_data()
    subjects = await db.get_subjects(data["scheme"], data["branch"], semester)
    keyboard_buttons = []
    if subjects:
        keyboard_buttons.extend([[InlineKeyboardButton(text=subj, callback_data=f"sub_subject_{subj}")] for subj in subjects])
    keyboard_buttons.extend([
        [InlineKeyboardButton(text="➕ Add New Subject", callback_data="new_subject")],
        [InlineKeyboardButton(text="🔙 Back", callback_data=f"sub_branch_{data['branch']}")],
        [InlineKeyboardButton(text="🏠 Menu", callback_data="back_to_menu")]
    ])
    await state.set_state(SubmissionStates.waiting_for_subject)
    await callback.message.edit_text(
        f"📚 Select or Add Subject for Semester {semester}:",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=keyboard_buttons)
    )

@router.callback_query(F.data == "new_subject")
async def submission_new_subject(callback: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    await state.set_state(SubmissionStates.waiting_for_new_subject)
    await callback.message.edit_text(
        f"📝 Enter the subject name for {data.get('scheme')}/{data.get('branch')}/Sem {data.get('semester')}:",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="🔙 Back", callback_data=f"sub_semester_{data.get('semester')}")]])
    )

@router.callback_query(F.data.startswith("sub_subject_"))
async def submission_subject_selected(callback: CallbackQuery, state: FSMContext):
    subject = callback.data.split("sub_subject_")[1]
    await state.update_data(subject=subject)
    data = await state.get_data()
    # Ask for module selection similar to new-subject flow
    await state.set_state(SubmissionStates.waiting_for_module)
    await callback.message.edit_text(
        f"🧩 Which module is this for {subject}?",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="Module 1", callback_data="pick_module_Module 1")],
            [InlineKeyboardButton(text="Module 2", callback_data="pick_module_Module 2")],
            [InlineKeyboardButton(text="Module 3", callback_data="pick_module_Module 3")],
            [InlineKeyboardButton(text="Module 4", callback_data="pick_module_Module 4")],
            [InlineKeyboardButton(text="Module 5", callback_data="pick_module_Module 5")],
            [InlineKeyboardButton(text="Other / Custom", callback_data="pick_module_custom")]
        ])
    )

@router.message(SubmissionStates.waiting_for_file)
async def process_file_submission(message: Message, state: FSMContext):
    if not message.document:
        await message.answer("❌ Please upload a document file.")
        return
    
    data = await state.get_data()
    file_id = message.document.file_id
    logger.info(f"User {message.from_user.id} uploaded file: {file_id}")
    
    await db.add_pending_resource(
        message.from_user.id,
        data["scheme"],
        data["branch"],
        data["semester"],
        data["subject"],
        "note",
        file_id,
        data.get("module")
    )
    
    await message.answer(
        "✅ Your note has been submitted for review!\n\n"
        "It will be available after admin approval (within 20 days).",
        reply_markup=create_back_to_menu()
    )
    await state.clear()

@router.message(SubmissionStates.waiting_for_link)
async def process_link_submission(message: Message, state: FSMContext):
    link = message.text.strip()
    if "youtube.com" not in link and "youtu.be" not in link:
        await message.answer("❌ Please provide a valid YouTube link.")
        return
    
    data = await state.get_data()
    logger.info(f"User {message.from_user.id} submitted video link: {link}")
    
    await db.add_pending_resource(
        message.from_user.id,
        data["scheme"],
        data["branch"],
        data["semester"],
        data["subject"],
        "video",
        link,
        data.get("module")
    )
    
    await message.answer(
        "✅ Your video link has been submitted for review!\n\n"
        "It will be available after admin approval (within 20 days).",
        reply_markup=create_back_to_menu()
    )
    await state.clear()

def register_handlers(dp):
    dp.include_router(router)
